import os
import imagehash

from PIL import Image


class ImageWatcher:
    def __init__(self, server_instance):
        self.server = server_instance
        self.image_extensions = {".jpg", ".jpeg", ".png"}

    def can_handle(self, file_path):
        """Check if this watcher can handle the given file."""
        _, ext = os.path.splitext(file_path.lower())
        return ext in self.image_extensions

    def process_file(self, file_path, action="created"):
        """Process an image file and store it in Redis."""
        if not self.can_handle(file_path) or not self.server.rc:
            return

        try:
            # Generate hash
            with Image.open(file_path) as img:
                if img.mode == "P" and "transparency" in img.info:
                    img = img.convert("RGBA")  # Avoid PIL warnings
                hash_value = str(imagehash.dhash(img))

            redis_key = f"image:{hash_value}"

            if self.server.rc.exists(redis_key):
                existing_data = self.server.rc.hgetall(redis_key)
                if existing_data:
                    hidden_status = existing_data.get(b"hidden", b"false").decode(
                        "utf-8"
                    )
                    if hidden_status == "true":
                        self.server.rc.hset(redis_key, "hidden", "false")
                        self.server.rc.hset(redis_key, "local_path", file_path)

                        filename = os.path.basename(file_path)
                        self.server.rc.hset(
                            "filename_to_hash_index", filename, hash_value
                        )

                        self.server.server_log(
                            f"[INFO] Unhidden existing image: {file_path}"
                        )

                        # Schedule type is immediate
                        if (
                            action != "scanned"
                            and self.server.embedding_schedule.get("schedule_type")
                            == "immediate"
                        ):
                            self.server.generate_immediate_embedding(redis_key)

                        if action != "scanned":
                            self._check_and_link_to_documents(filename, hash_value)
                        return
                    else:
                        # Image exists and is not hidden, skip processing
                        return

            image_data = {
                "hash": hash_value,
                "local_path": file_path,
                "remote_path": "",
                "filename": os.path.basename(file_path),
                "documents": "",
                "hidden": "false",
            }

            filename = os.path.basename(file_path)

            pipe = self.server.rc.client.pipeline()
            pipe.hset(redis_key, mapping=image_data)
            pipe.hset("filename_to_hash_index", filename, hash_value)
            pipe.execute()

            if action != "scanned":
                self._check_and_link_to_documents(filename, hash_value)

            # Schedule type is immediate
            if (
                action != "scanned"
                and self.server.embedding_schedule.get("schedule_type") == "immediate"
            ):
                self.server.generate_immediate_embedding(redis_key)

            # self.server.server_log(f"[INFO] Processed image {action}: {file_path}")

        except Exception as e:
            self.server.server_log(f"[ERROR] Failed to process image {file_path}: {e}")

    def remove_file(self, file_path):
        """Mark image as hidden when file is deleted instead of removing from Redis."""
        if not self.server.rc:
            return

        try:
            filename = os.path.basename(file_path)

            image_hash = self.server.rc.hget("filename_to_hash_index", filename)

            if image_hash:
                if isinstance(image_hash, bytes):
                    image_hash = image_hash.decode("utf-8")

                redis_key = f"image:{image_hash}"

                image_data = self.server.rc.hgetall(redis_key)
                if image_data:
                    stored_path = image_data.get(b"local_path", b"").decode("utf-8")

                    if stored_path == file_path:
                        self.server.rc.hset(redis_key, "hidden", "true")

                        self.server.rc.hdel("filename_to_hash_index", filename)

                        self.server.server_log(
                            f"[INFO] Marked deleted image as hidden in Redis: {file_path}"
                        )
                        return
                    else:
                        self.server.server_log(
                            f"[WARNING] Path mismatch for {filename}: stored={stored_path}, deleted={file_path}"
                        )

            self.server.server_log(
                f"[INFO] Filename index lookup failed for {filename}, falling back to full scan"
            )
            self._remove_file_fallback(file_path)

        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to mark deleted image as hidden in Redis: {e}"
            )

    def _remove_file_fallback(self, file_path):
        """Fallback method using full scan when filename index lookup fails."""
        try:
            pattern = "image:*"
            cursor = 0

            while True:
                cursor, keys = self.server.rc.scan(cursor, match=pattern, count=100)

                for key in keys:
                    key_str = key.decode("utf-8") if isinstance(key, bytes) else key
                    image_data = self.server.rc.hgetall(key_str)
                    if (
                        image_data
                        and image_data.get(b"local_path", b"").decode("utf-8")
                        == file_path
                    ):
                        self.server.rc.hset(key_str, "hidden", "true")

                        filename = os.path.basename(file_path)
                        self.server.rc.hdel("filename_to_hash_index", filename)
                        self.server.server_log(
                            f"[INFO] Marked deleted image as hidden in Redis (via fallback): {file_path}"
                        )
                        return  # Exit early

                if cursor == 0:
                    break

        except Exception as e:
            self.server.server_log(f"[ERROR] Fallback removal failed: {e}")

    def update_file_path(self, old_path, new_path):
        """Update file path when image is moved."""
        if not self.server.rc:
            return

        try:
            pattern = "image:*"
            cursor = 0

            while True:
                cursor, keys = self.server.rc.scan(cursor, match=pattern, count=100)

                for key in keys:
                    key_str = key.decode("utf-8") if isinstance(key, bytes) else key
                    image_data = self.server.rc.hgetall(key_str)
                    if (
                        image_data
                        and image_data.get(b"local_path", b"").decode("utf-8")
                        == old_path
                    ):
                        old_filename = os.path.basename(old_path)
                        new_filename = os.path.basename(new_path)
                        image_hash = image_data.get(b"hash", b"").decode("utf-8")

                        if old_filename != new_filename and image_hash:
                            self.server.rc.hdel("filename_to_hash_index", old_filename)
                            self.server.rc.hset(
                                "filename_to_hash_index", new_filename, image_hash
                            )

                        self.server.rc.hset(key_str, "local_path", new_path)
                        self.server.rc.hset(key_str, "filename", new_filename)
                        self.server.server_log(
                            f"[INFO] Updated moved image path in Redis: {old_path} -> {new_path}"
                        )
                        return  # Exit early

                if cursor == 0:
                    break
        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to update moved image path in Redis: {e}"
            )

    def _extract_base_filename(self, file_path):
        """Extract base filename without extension for linking."""
        return os.path.splitext(os.path.basename(file_path))[0]

    def scan_existing_files(self, folders):
        """Scan and process existing image files in the given folders using batch processing."""
        all_image_files = []

        # Collect all image files first
        for folder in folders:
            if not os.path.exists(folder):
                continue

            self.server.server_log(f"[INFO] Scanning for images in: {folder}")

            for root, dirs, files in os.walk(folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    if self.can_handle(file_path):
                        all_image_files.append(file_path)

        self.server.server_log(
            f"[INFO] Found {len(all_image_files)} image files. Starting batch processing..."
        )

        if all_image_files:
            processed_count = self.process_files_batch(all_image_files, batch_size=200)

            if processed_count > 0:
                self.server.server_log("[INFO] Starting batch document linking...")
                self._batch_resolve_pending_documents()
        else:
            processed_count = 0

        self.server.server_log(
            f"[INFO] Image scan completed. Processed {processed_count} images"
        )
        return processed_count

    def process_files_batch(self, file_paths, batch_size=100):
        """Process multiple image files in batches for maximum performance."""
        processed_count = 0
        total_files = len(file_paths)

        for i in range(0, total_files, batch_size):
            batch = file_paths[i : i + batch_size]
            pipe = self.server.rc.client.pipeline()
            batch_data = []

            for file_path in batch:
                if not self.can_handle(file_path):
                    continue

                try:
                    with Image.open(file_path) as img:
                        if img.mode == "P" and "transparency" in img.info:
                            img = img.convert("RGBA")
                        hash_value = str(imagehash.dhash(img))

                    redis_key = f"image:{hash_value}"
                    filename = os.path.basename(file_path)

                    if self.server.rc.exists(redis_key):
                        existing_data = self.server.rc.hgetall(redis_key)
                        if existing_data:
                            hidden_status = existing_data.get(
                                b"hidden", b"false"
                            ).decode("utf-8")
                            if hidden_status == "true":
                                pipe.hset(redis_key, "hidden", "false")
                                pipe.hset(redis_key, "local_path", file_path)
                                pipe.hset(
                                    "filename_to_hash_index", filename, hash_value
                                )
                                continue
                        # Image exists and is not hidden, skip
                        continue

                    image_data = {
                        "hash": hash_value,
                        "local_path": file_path,
                        "remote_path": "",
                        "filename": filename,
                        "documents": "",
                        "hidden": "false",
                    }

                    batch_data.append((redis_key, image_data, filename, hash_value))

                except Exception as e:
                    self.server.server_log(
                        f"[ERROR] Failed to process image {file_path}: {e}"
                    )

            if batch_data:
                try:
                    for redis_key, image_data, filename, hash_value in batch_data:
                        pipe.hset(redis_key, mapping=image_data)
                        pipe.hset("filename_to_hash_index", filename, hash_value)

                    pipe.execute()
                    processed_count += len(batch_data)

                    if processed_count % 1000 == 0:
                        self.server.server_log(
                            f"[INFO] Batch processed {processed_count}/{total_files} images"
                        )

                except Exception as e:
                    self.server.server_log(f"[ERROR] Batch processing failed: {e}")

        self.server.server_log(
            f"[INFO] Batch processing completed. Processed {processed_count} images"
        )
        return processed_count

    def _process_single_image(self, file_path):
        """Process a single image file efficiently."""
        try:
            with Image.open(file_path) as img:
                if img.mode == "P" and "transparency" in img.info:
                    img = img.convert("RGBA")
                hash_value = str(imagehash.dhash(img))

            redis_key = f"image:{hash_value}"

            if not self.server.rc.exists(redis_key):
                self.process_file(file_path, "scanned")
                return True
            else:
                return False

        except Exception as e:
            self.server.server_log(f"[ERROR] Failed to process image {file_path}: {e}")
            return False

    def _check_and_link_to_documents(self, filename, image_hash):
        """Check if any documents are waiting for this image and link them."""
        try:
            if (
                hasattr(self.server, "file_watcher")
                and hasattr(self.server.file_watcher, "handler")
                and hasattr(self.server.file_watcher.handler, "document_watcher")
            ):
                document_watcher = self.server.file_watcher.handler.document_watcher
                document_watcher.resolve_pending_images_for_filename(
                    filename, image_hash
                )
            else:
                self.server.server_log(
                    "[WARNING] Document watcher not available for image linking"
                )
        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to check and link image {filename} to documents: {e}"
            )

    def _batch_resolve_pending_documents(self):
        """Batch resolve all pending document-image links after bulk processing."""
        try:
            if (
                hasattr(self.server, "file_watcher")
                and hasattr(self.server.file_watcher, "handler")
                and hasattr(self.server.file_watcher.handler, "document_watcher")
            ):
                document_watcher = self.server.file_watcher.handler.document_watcher

                pending_keys = []
                cursor = 0
                while True:
                    cursor, keys = self.server.rc.scan(
                        cursor, match="pending_image:*", count=1000
                    )
                    pending_keys.extend(keys)
                    if cursor == 0:
                        break

                links_resolved = 0
                for pending_key in pending_keys:
                    pending_key_str = (
                        pending_key.decode("utf-8")
                        if isinstance(pending_key, bytes)
                        else pending_key
                    )
                    filename = pending_key_str.replace("pending_image:", "")

                    image_hash = self.server.rc.hget("filename_to_hash_index", filename)
                    if image_hash:
                        image_hash = (
                            image_hash.decode("utf-8")
                            if isinstance(image_hash, bytes)
                            else image_hash
                        )
                        document_watcher.resolve_pending_images_for_filename(
                            filename, image_hash
                        )
                        links_resolved += 1

                if links_resolved > 0:
                    self.server.server_log(
                        f"[INFO] Batch resolved {links_resolved} pending document-image links"
                    )
            else:
                self.server.server_log(
                    "[WARNING] Document watcher not available for batch linking"
                )

        except Exception as e:
            self.server.server_log(
                f"[ERROR] Failed to batch resolve pending documents: {e}"
            )
