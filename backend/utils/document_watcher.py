import os
import json
import hashlib

from pathlib import Path


class DocumentWatcher:
    """Handles document file operations and maintains bidirectional links with images."""

    def __init__(self, server_instance):
        self.server = server_instance
        self.document_extensions = {".json"}

    def can_handle(self, file_path):
        """Check if this watcher can handle the given file."""
        _, ext = os.path.splitext(file_path.lower())
        return ext in self.document_extensions

    def process_file(self, file_path, action="created"):
        """Process a document file and store it in Redis."""
        if not self.can_handle(file_path) or not self.server.rc:
            return

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                doc_data = json.load(f)

            is_valid, error_msg = self._validate_document_structure(doc_data)
            if not is_valid:
                self.server.server_log(
                    f"[ERROR] Invalid document structure in {file_path}: {error_msg}"
                )
                return

            title = doc_data["title"]
            doc_hash = self._generate_document_hash(title)

            images = doc_data.get("images", [])
            resolved_images, unresolved_images = self._resolve_image_paths(images)

            redis_key = f"document:{doc_hash}"

            # Check if document exists and handle hidden case
            if self.server.rc.exists(redis_key):
                existing_data = self.server.rc.hgetall(redis_key)
                if existing_data:
                    hidden_status = existing_data.get(b"hidden", b"false").decode(
                        "utf-8"
                    )
                    if hidden_status == "true":
                        self.server.server_log(
                            f"[INFO] Unhiding existing document: {file_path}"
                        )

                        document_data = {
                            "hash": doc_hash,
                            "title": title,
                            "content": doc_data["content"],
                            "images": json.dumps(resolved_images),
                            "unresolved_images": json.dumps(unresolved_images),
                            "url": doc_data.get("url", ""),
                            "date": doc_data.get("date", ""),
                            "local_path": file_path,
                            "remote_path": "",
                            "filename": os.path.basename(file_path),
                            "hidden": "false",
                        }

                        self.server.rc.hset(redis_key, mapping=document_data)

                        self._create_pending_image_index(doc_hash, unresolved_images)
                        self._link_document_to_images(doc_hash, resolved_images)

                        newly_resolved_count = self.resolve_single_document_images(
                            doc_hash
                        )
                        if newly_resolved_count > 0:
                            self.server.server_log(
                                f"[INFO] Auto-resolved {newly_resolved_count} additional images for restored document {os.path.basename(file_path)}"
                            )

                        # Schedule type is immediate
                        if (
                            action != "scanned"
                            and self.server.embedding_schedule.get("schedule_type")
                            == "immediate"
                        ):
                            self.server.generate_immediate_embedding(redis_key)
                        return

            document_data = {
                "hash": doc_hash,
                "title": title,
                "content": doc_data["content"],
                "images": json.dumps(resolved_images),
                "unresolved_images": json.dumps(unresolved_images),
                "url": doc_data.get("url", ""),
                "date": doc_data.get("date", ""),
                "local_path": file_path,
                "remote_path": "",
                "filename": os.path.basename(file_path),
                "hidden": "false",
            }

            self.server.rc.hset(redis_key, mapping=document_data)

            self._create_pending_image_index(doc_hash, unresolved_images)

            self._link_document_to_images(doc_hash, resolved_images)

            newly_resolved_count = self.resolve_single_document_images(doc_hash)
            if newly_resolved_count > 0:
                self.server.server_log(
                    f"[INFO] Auto-resolved {newly_resolved_count} additional images for document {os.path.basename(file_path)}"
                )

            # Schedule type is immediate
            if (
                action != "scanned"
                and self.server.embedding_schedule.get("schedule_type") == "immediate"
            ):
                self.server.generate_immediate_embedding(redis_key)

            # self.server.server_log(
            #     f"[INFO] Processed document {action}: {file_path} -> {doc_hash}"
            # )

        except json.JSONDecodeError as e:
            self.server.server_log(f"[ERROR] Invalid JSON in document {file_path}: {e}")
        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to process document {file_path}: {e}"
            )

    def remove_file(self, file_path):
        """Mark document as hidden when file is deleted instead of removing from Redis."""
        if not self.server.rc:
            return

        try:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    doc_data = json.load(f)

                title = doc_data.get("title", "")
                if title:
                    doc_hash = self._generate_document_hash(title)
                    redis_key = f"document:{doc_hash}"

                    existing_data = self.server.rc.hgetall(redis_key)
                    if existing_data:
                        stored_path = existing_data.get(b"local_path", b"").decode(
                            "utf-8"
                        )

                        if stored_path == file_path:
                            resolved_images_str = existing_data.get(
                                b"images", b""
                            ).decode("utf-8")
                            unresolved_images_str = existing_data.get(
                                b"unresolved_images", b""
                            ).decode("utf-8")

                            try:
                                resolved_images = (
                                    json.loads(resolved_images_str)
                                    if resolved_images_str
                                    else []
                                )
                                unresolved_images = (
                                    json.loads(unresolved_images_str)
                                    if unresolved_images_str
                                    else []
                                )
                            except Exception:
                                resolved_images = []
                                unresolved_images = []

                            self._unlink_document_from_images(doc_hash, resolved_images)
                            self._remove_pending_image_index(
                                doc_hash, unresolved_images
                            )

                            self.server.rc.hset(redis_key, "hidden", "true")
                            self.server.server_log(
                                f"[INFO] Marked deleted document as hidden in Redis: {file_path}"
                            )
                            return
                        else:
                            self.server.server_log(
                                f"[WARNING] Path mismatch for document {title}: stored={stored_path}, deleted={file_path}"
                            )

            except (json.JSONDecodeError, FileNotFoundError, KeyError) as e:
                self.server.server_log(
                    f"[INFO] Could not parse document file {file_path} for fast removal: {e}, falling back to scan"
                )

            self._remove_file_fallback(file_path)

        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to mark deleted document as hidden in Redis: {e}"
            )

    def _remove_file_fallback(self, file_path):
        """Fallback method using full scan when direct lookup fails."""
        try:
            pattern = "document:*"
            cursor = 0

            while True:
                cursor, keys = self.server.rc.scan(cursor, match=pattern, count=100)

                for key in keys:
                    key_str = key.decode("utf-8") if isinstance(key, bytes) else key
                    doc_data = self.server.rc.hgetall(key_str)
                    if (
                        doc_data
                        and doc_data.get(b"local_path", b"").decode("utf-8")
                        == file_path
                    ):
                        doc_hash = key_str.split(":")[1]
                        resolved_images_str = doc_data.get(b"images", b"").decode(
                            "utf-8"
                        )
                        unresolved_images_str = doc_data.get(
                            b"unresolved_images", b""
                        ).decode("utf-8")
                        try:
                            resolved_images = (
                                json.loads(resolved_images_str)
                                if resolved_images_str
                                else []
                            )
                            unresolved_images = (
                                json.loads(unresolved_images_str)
                                if unresolved_images_str
                                else []
                            )
                        except Exception:
                            resolved_images = []
                            unresolved_images = []

                        self._unlink_document_from_images(doc_hash, resolved_images)

                        self._remove_pending_image_index(doc_hash, unresolved_images)

                        self.server.rc.hset(key_str, "hidden", "true")
                        self.server.server_log(
                            f"[INFO] Marked deleted document as hidden in Redis (via fallback): {file_path}"
                        )
                        return

                if cursor == 0:
                    break

        except Exception as e:
            self.server.server_log(f"[ERROR] Fallback document removal failed: {e}")

    def update_file_path(self, old_path, new_path):
        """Update file path when document is moved."""
        if not self.server.rc:
            return

        try:
            pattern = "document:*"
            cursor = 0

            while True:
                cursor, keys = self.server.rc.scan(cursor, match=pattern, count=100)

                for key in keys:
                    key_str = key.decode("utf-8") if isinstance(key, bytes) else key
                    doc_data = self.server.rc.hgetall(key_str)
                    if (
                        doc_data
                        and doc_data.get(b"local_path", b"").decode("utf-8") == old_path
                    ):
                        self.server.rc.hset(key_str, "local_path", new_path)
                        self.server.rc.hset(
                            key_str, "filename", os.path.basename(new_path)
                        )
                        self.server.server_log(
                            f"[INFO] Updated moved document path in Redis: {old_path} -> {new_path}"
                        )
                        return

                if cursor == 0:
                    break
        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to update moved document path in Redis: {e}"
            )

    def scan_existing_files(self, folders):
        """Scan and process existing document files in the given folders."""
        processed_count = 0

        for folder in folders:
            if not os.path.exists(folder):
                continue

            self.server.server_log(f"[INFO] Processing existing documents in: {folder}")

            for root, _, files in os.walk(folder):
                for file in files:
                    if self.can_handle(file):
                        file_path = os.path.join(root, file)
                        try:
                            with open(file_path, "r", encoding="utf-8") as f:
                                doc_data = json.load(f)

                            if "title" in doc_data:
                                doc_hash = self._generate_document_hash(
                                    doc_data["title"]
                                )
                                redis_key = f"document:{doc_hash}"

                                if not self.server.rc.exists(redis_key):
                                    self.process_file(file_path, "scanned")
                                    processed_count += 1
                        except Exception as e:
                            self.server.server_log(
                                f"[ERROR] Failed to process existing document {file_path}: {e}"
                            )

        self.server.server_log(
            f"[INFO] Document scan completed. Processed {processed_count} documents"
        )
        return processed_count

    def _process_single_document(self, file_path):
        """Process a single document file efficiently during bulk scanning."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                doc_data = json.load(f)

            if "title" in doc_data:
                doc_hash = self._generate_document_hash(doc_data["title"])
                redis_key = f"document:{doc_hash}"

                if not self.server.rc.exists(redis_key):
                    self._process_file_fast(file_path, doc_data, doc_hash, "scanned")
                    return True
                else:
                    existing_data = self.server.rc.hgetall(redis_key)
                    if existing_data:
                        hidden_status = existing_data.get(b"hidden", b"false").decode(
                            "utf-8"
                        )
                        if hidden_status == "true":
                            self._process_file_fast(
                                file_path, doc_data, doc_hash, "unhidden"
                            )
                            self.server.rc.hset(redis_key, "hidden", "false")
                            self.server.server_log(
                                f"[INFO] Unhidden existing document during scan: {file_path}"
                            )
                            return True
                    return False
            return False

        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to process document {file_path}: {e}"
            )
            return False

    def _process_file_fast(self, file_path, doc_data, doc_hash, action):
        """Fast document processing that skips expensive image resolution."""
        try:
            is_valid, error_msg = self._validate_document_structure(doc_data)
            if not is_valid:
                self.server.server_log(
                    f"[ERROR] Invalid document structure in {file_path}: {error_msg}"
                )
                return

            title = doc_data["title"]

            images = doc_data.get("images", [])

            redis_key = f"document:{doc_hash}"
            document_data = {
                "hash": doc_hash,
                "title": title,
                "content": doc_data["content"],
                "images": json.dumps([]),
                "unresolved_images": json.dumps(images),
                "url": doc_data.get("url", ""),
                "date": doc_data.get("date", ""),
                "local_path": file_path,
                "remote_path": "",
                "filename": os.path.basename(file_path),
                "hidden": "false",
            }

            self.server.rc.hset(redis_key, mapping=document_data)

            self._create_pending_image_index(doc_hash, images)

            # self.server.server_log(
            #     f"[INFO] Processed document {action}: {file_path} -> {doc_hash}"
            # )

        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to process document {file_path}: {e}"
            )

    def _generate_document_hash(self, title):
        """Generate MD5 hash for document based on title."""
        return hashlib.md5(title.encode("utf-8")).hexdigest()

    def _extract_base_filename(self, file_path):
        """Extract base filename without extension for linking."""
        return Path(file_path).stem

    def _validate_document_structure(self, doc_data):
        """Validate that the document has required fields."""
        required_fields = ["title", "content"]
        for field in required_fields:
            if field not in doc_data:
                return False, f"Missing required field: {field}"
        return True, None

    def _resolve_image_paths(self, images):
        """Convert image filenames to hashes and establish bidirectional links."""
        resolved_images = []
        unresolved_images = []

        for image_filename in images:
            image_hash = self._find_image_hash_by_filename(image_filename)
            if image_hash:
                resolved_images.append({"hash": image_hash, "filename": image_filename})
            else:
                unresolved_images.append(image_filename)

        return resolved_images, unresolved_images

    def _link_document_to_images(self, doc_hash, resolved_images):
        """Add this document to the documents list of each linked image."""
        for image_info in resolved_images:
            image_hash = image_info["hash"]
            image_key = f"image:{image_hash}"

            try:
                current_docs = self.server.rc.hget(image_key, "documents")
                if current_docs:
                    current_docs = (
                        current_docs.decode("utf-8")
                        if isinstance(current_docs, bytes)
                        else current_docs
                    )
                    if current_docs:
                        doc_list = (
                            json.loads(current_docs) if current_docs != "" else []
                        )
                    else:
                        doc_list = []
                else:
                    doc_list = []

                if doc_hash not in doc_list:
                    doc_list.append(doc_hash)
                    self.server.rc.hset(image_key, "documents", json.dumps(doc_list))

            except Exception as e:
                self.server.server_log(
                    f"[ERROR] Failed to link document {doc_hash} to image {image_hash}: {e}"
                )

    def _unlink_document_from_images(self, doc_hash, resolved_images):
        """Remove this document from the documents list of each linked image."""
        for image_info in resolved_images:
            if isinstance(image_info, dict) and "hash" in image_info:
                image_hash = image_info["hash"]
                image_key = f"image:{image_hash}"

                try:
                    current_docs = self.server.rc.hget(image_key, "documents")
                    if current_docs:
                        current_docs = (
                            current_docs.decode("utf-8")
                            if isinstance(current_docs, bytes)
                            else current_docs
                        )
                        if current_docs:
                            doc_list = (
                                json.loads(current_docs) if current_docs != "" else []
                            )
                        else:
                            doc_list = []
                    else:
                        doc_list = []

                    if doc_hash in doc_list:
                        doc_list.remove(doc_hash)
                        self.server.rc.hset(
                            image_key, "documents", json.dumps(doc_list)
                        )

                except Exception as e:
                    self.server.server_log(
                        f"[ERROR] Failed to unlink document {doc_hash} from image {image_hash}: {e}"
                    )

    def _find_image_hash_by_filename(self, filename):
        """Find image hash in Redis."""
        if not self.server.rc:
            return None

        try:
            filename_index_key = "filename_to_hash_index"
            image_hash = self.server.rc.hget(filename_index_key, filename)

            if image_hash:
                return (
                    image_hash.decode("utf-8")
                    if isinstance(image_hash, bytes)
                    else image_hash
                )

            return None
        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to find image hash for {filename}: {e}"
            )
            return None

    def resolve_pending_images_for_filename(self, filename, image_hash):
        """When a new image is added, check if any documents are waiting for it."""
        if not self.server.rc:
            return

        try:
            pending_key = f"pending_image:{filename}"
            waiting_docs = self.server.rc.smembers(pending_key)

            documents_updated = []

            for doc_hash_bytes in waiting_docs:
                doc_hash = (
                    doc_hash_bytes.decode("utf-8")
                    if isinstance(doc_hash_bytes, bytes)
                    else doc_hash_bytes
                )
                doc_key = f"document:{doc_hash}"

                try:
                    unresolved_images_str = self.server.rc.hget(
                        doc_key, "unresolved_images"
                    )
                    if unresolved_images_str:
                        unresolved_images_str = (
                            unresolved_images_str.decode("utf-8")
                            if isinstance(unresolved_images_str, bytes)
                            else unresolved_images_str
                        )
                        try:
                            unresolved_images = (
                                json.loads(unresolved_images_str)
                                if unresolved_images_str
                                else []
                            )
                        except Exception:
                            unresolved_images = []

                        if filename in unresolved_images:
                            unresolved_images.remove(filename)

                            resolved_images_str = self.server.rc.hget(doc_key, "images")
                            if resolved_images_str:
                                resolved_images_str = (
                                    resolved_images_str.decode("utf-8")
                                    if isinstance(resolved_images_str, bytes)
                                    else resolved_images_str
                                )
                                try:
                                    resolved_images = (
                                        json.loads(resolved_images_str)
                                        if resolved_images_str
                                        else []
                                    )
                                except Exception:
                                    resolved_images = []
                            else:
                                resolved_images = []

                            resolved_images.append(
                                {"hash": image_hash, "filename": filename}
                            )

                            self.server.rc.hset(
                                doc_key, "images", json.dumps(resolved_images)
                            )
                            self.server.rc.hset(
                                doc_key,
                                "unresolved_images",
                                json.dumps(unresolved_images),
                            )

                            self._link_document_to_images(
                                doc_hash, [{"hash": image_hash, "filename": filename}]
                            )

                            documents_updated.append(doc_hash)

                except Exception as e:
                    self.server.server_log(
                        f"[ERROR] Failed to update document {doc_hash} for image {filename}: {e}"
                    )

            if waiting_docs:
                self.server.rc.delete(pending_key)

            # if documents_updated:
            #     self.server.server_log(
            #         f"[INFO] Efficiently linked image {filename} ({image_hash}) to {len(documents_updated)} documents using Redis sets"
            #     )

        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to resolve pending images for {filename}: {e}"
            )

    def _create_pending_image_index(self, doc_hash, unresolved_images):
        """Create Redis sets for efficiency."""
        try:
            for filename in unresolved_images:
                pending_key = f"pending_image:{filename}"
                self.server.rc.sadd(pending_key, doc_hash)
        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to create pending image index for document {doc_hash}: {e}"
            )

    def _remove_pending_image_index(self, doc_hash, unresolved_images):
        """Remove document from pending image sets when document is removed/resolved."""
        try:
            for filename in unresolved_images:
                pending_key = f"pending_image:{filename}"
                self.server.rc.srem(pending_key, doc_hash)
                # Clean up empty sets
                if not self.server.rc.smembers(pending_key):
                    self.server.rc.delete(pending_key)
        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to remove pending image index for document {doc_hash}: {e}"
            )

    def bulk_resolve_unresolved_images(self):
        """
        Resolve all unresolved images across all documents.
        This should be called after bulk file processing or periodically.
        """
        if not self.server.rc:
            return {"success": False, "error": "Redis not connected"}

        try:
            filename_index = self.server.rc.hgetall("filename_to_hash_index")
            filename_to_hash = {}
            for k, v in filename_index.items():
                key = k.decode("utf-8") if isinstance(k, bytes) else k
                value = v.decode("utf-8") if isinstance(v, bytes) else v
                filename_to_hash[key] = value

            if not filename_to_hash:
                return {
                    "success": True,
                    "resolved_count": 0,
                    "message": "No filename index found",
                }

            doc_keys = self.server.rc.keys("document:*")
            total_resolved = 0
            documents_updated = 0

            for doc_key in doc_keys:
                doc_data = self.server.rc.hgetall(doc_key)
                if not doc_data or b"unresolved_images" not in doc_data:
                    continue

                unresolved_raw = doc_data[b"unresolved_images"].decode("utf-8")
                try:
                    unresolved_images = (
                        json.loads(unresolved_raw) if unresolved_raw else []
                    )
                except Exception:
                    continue

                if not unresolved_images:
                    continue

                resolved_raw = doc_data.get(b"images", b"[]").decode("utf-8")
                try:
                    resolved_images = json.loads(resolved_raw) if resolved_raw else []
                except Exception:
                    resolved_images = []

                # Resolve what we can
                newly_resolved = []
                still_unresolved = []

                for filename in unresolved_images:
                    if filename in filename_to_hash:
                        image_hash = filename_to_hash[filename]
                        newly_resolved.append(
                            {"hash": image_hash, "filename": filename}
                        )
                        total_resolved += 1
                    else:
                        still_unresolved.append(filename)

                if newly_resolved:
                    resolved_images.extend(newly_resolved)

                    doc_hash = doc_key.decode("utf-8").replace("document:", "")
                    self.server.rc.hset(doc_key, "images", json.dumps(resolved_images))
                    self.server.rc.hset(
                        doc_key, "unresolved_images", json.dumps(still_unresolved)
                    )

                    self._link_document_to_images(doc_hash, newly_resolved)

                    for image_info in newly_resolved:
                        self._remove_pending_image_index(
                            doc_hash, [image_info["filename"]]
                        )

                    documents_updated += 1

            self.server.server_log(
                f"[INFO] Bulk resolution completed: {total_resolved} images resolved across {documents_updated} documents"
            )

            return {
                "success": True,
                "resolved_count": total_resolved,
                "documents_updated": documents_updated,
                "message": f"Resolved {total_resolved} images across {documents_updated} documents",
            }

        except Exception as e:
            error_msg = f"Bulk resolution failed: {e}"
            self.server.server_log(f"[ERROR] {error_msg}")
            return {"success": False, "error": error_msg}

    def resolve_single_document_images(self, doc_hash):
        """
        Resolve unresolved images for a single document.
        Called after processing individual documents.
        """
        if not self.server.rc:
            return 0

        try:
            doc_key = f"document:{doc_hash}"
            doc_data = self.server.rc.hgetall(doc_key)
            if not doc_data or b"unresolved_images" not in doc_data:
                return 0

            filename_index = self.server.rc.hgetall("filename_to_hash_index")
            filename_to_hash = {}
            for k, v in filename_index.items():
                key = k.decode("utf-8") if isinstance(k, bytes) else k
                value = v.decode("utf-8") if isinstance(v, bytes) else v
                filename_to_hash[key] = value

            unresolved_raw = doc_data[b"unresolved_images"].decode("utf-8")
            try:
                unresolved_images = json.loads(unresolved_raw) if unresolved_raw else []
            except Exception:
                return 0

            if not unresolved_images:
                return 0

            resolved_raw = doc_data.get(b"images", b"[]").decode("utf-8")
            try:
                resolved_images = json.loads(resolved_raw) if resolved_raw else []
            except Exception:
                resolved_images = []

            newly_resolved = []
            still_unresolved = []

            for filename in unresolved_images:
                if filename in filename_to_hash:
                    image_hash = filename_to_hash[filename]
                    newly_resolved.append({"hash": image_hash, "filename": filename})
                else:
                    still_unresolved.append(filename)

            if newly_resolved:
                resolved_images.extend(newly_resolved)

                self.server.rc.hset(doc_key, "images", json.dumps(resolved_images))
                self.server.rc.hset(
                    doc_key, "unresolved_images", json.dumps(still_unresolved)
                )

                self._link_document_to_images(doc_hash, newly_resolved)

                for image_info in newly_resolved:
                    self._remove_pending_image_index(doc_hash, [image_info["filename"]])

                # self.server.server_log(
                #     f"[INFO] Auto-resolved {len(newly_resolved)} images for document {doc_hash}"
                # )

            return len(newly_resolved)

        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to resolve images for document {doc_hash}: {e}"
            )
            return 0
