import os
import json
import time
import datetime
import threading

from flask import Flask
from redis.commands.search.field import TextField

from utils.controller import Controller
from utils.generic_watcher import GenericFileWatcher


class Server:
    CONFIG_FILE = "config.json"
    LOG_FILE = "server.log"

    def server_log(self, message):
        print(message)
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.log_file.write(f"{timestamp}: {message}\n")
        self.log_file.flush()

    def __init__(self, config_path=None):
        self.log_file = open(self.LOG_FILE, "a", encoding="utf-8")
        self.server_log("[INFO] Initializing Server...")

        self.app_name = None
        self.version = None
        self.production = False
        self.config_path = config_path or self.CONFIG_FILE

        self.redis_host = None
        self.redis_port = None
        self.redis_db = None

        self.watched_folders = []
        self.model_alias = None
        self.embedding_schedule = None

        self.scheduler_thread = None
        self.scheduler_running = False

        self.dynamic_loading_enabled = False
        self.unload_timeout_minutes = 10
        self.model_last_used = None
        self.unload_timer = None
        self.model_loading_lock = threading.Lock()
        self.pending_search_requests = []

        self.embedding_progress = {
            "active": False,
            "stage": "",
            "current": 0,
            "total": 0,
            "processed": 0,
            "skipped": 0,
            "errors": 0,
            "start_time": None,
        }

        self.load_config()
        self.server_log("[INFO] Server configuration loaded successfully.")

        self.watched_folders = [
            os.path.abspath(folder) for folder in self.watched_folders
        ]
        if not self.watched_folders:
            self.server_log(
                "[WARNING] No watched folders specified in the configuration."
            )

        self.app = Flask(self.app_name)

        models_config_full_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            self.models_config_path,
        )
        self.controller = Controller(
            logger=self.server_log,
            models_config_path=models_config_full_path,
            model_alias=self.model_alias,
        )

        if not self.controller.redis_connect(
            self.redis_host, self.redis_port, self.redis_db
        ):
            exit(1)

        try:
            self.controller.index("image:", [], self.model_alias, False)
        except Exception as e:
            self.server_log(
                f"[INFO] Skipping indexing (will be created after embeddings are generated): {e}"
            )

        self.rc = self.controller.rc

        if not self.dynamic_loading_enabled:
            if not self.controller.load_model(self.model_alias):
                self.server_log("[ERROR] Failed to load model.")
                exit(1)
        else:
            self.server_log(
                "[INFO] Dynamic model loading enabled - model will be loaded on first query."
            )

        self.create_watchers()

        self.background_init_thread = threading.Thread(
            target=self._background_initialization, daemon=True
        )
        self.background_init_thread.start()

    def __str__(self):
        return f"Server(app_name={self.app_name}, version={self.version}, redis_host={self.redis_host}, redis_port={self.redis_port}, redis_db={self.redis_db}, watched_folders={self.watched_folders})"

    def _background_initialization(self):
        """Run background initialization tasks that shouldn't block server startup."""
        self.server_log("[INFO] Starting background initialization...")

        time.sleep(2)  # Give some time for the server to start

        self.server_log("[INFO] Processing existing files in background...")
        self.process_existing_files()

        self.start_scheduler()

        self.server_log("[INFO] Background initialization completed.")

    def load_config(self):
        with open(self.config_path, "r") as f:
            config = json.load(f)

            self.app_name = config.get("app_name", "DefaultApp")
            self.version = config.get("version", "1.0.0")
            self.production = config.get("production", False)

            self.redis_host = config.get("redis_host", "localhost")
            self.redis_port = config.get("redis_port", 6379)
            self.redis_db = config.get("redis_db", 0)

            self.watched_folders = config.get("watched_folders", [])

            self.model_alias = config.get("model_alias", "")

            self.models_config_path = config.get("models_config_path", "models.json")

            self.embedding_schedule = config.get(
                "embedding_schedule",
                {"schedule_type": "manual", "start_hour": 1, "interval_hours": 24},
            )

            dynamic_config = config.get("dynamic_model_loading", {})
            self.dynamic_loading_enabled = dynamic_config.get("enabled", False)
            self.unload_timeout_minutes = dynamic_config.get(
                "unload_timeout_minutes", 10
            )

    def try_create_index(self):
        """
        Attempt to create the image and document indices if embeddings are available.
        Safe to call multiple times.
        """
        try:
            self.controller.index(
                "image:", [TextField(name="hidden")], self.model_alias
            )
            self.server_log("[INFO] Image index created successfully.")

            self.controller.index(
                "document:", [TextField(name="hidden")], self.model_alias
            )
            self.server_log("[INFO] Document index created successfully.")
            return True
        except Exception as e:
            self.server_log(f"[INFO] Cannot create indices yet: {e}")
            return False

    def create_watchers(self):
        """Initialize and start the generic file watcher."""
        self.file_watcher = GenericFileWatcher(self, self.watched_folders)
        self.file_watcher.start()

    def stop_watchers(self):
        """Stop the generic file watcher."""
        if hasattr(self, "file_watcher"):
            self.file_watcher.stop()
            self.server_log("[INFO] All watchers stopped.")

    def process_existing_files(self):
        """Process existing files in watched folders."""
        if hasattr(self, "file_watcher"):
            self.file_watcher.scan_existing_files()

    def get_server_statistics(self):
        """Get server statistics including image counts."""
        try:
            pipe = self.rc.client.pipeline()

            pattern_image = "image:*"
            pattern_doc = "document:*"

            all_image_keys = self.rc.keys(pattern_image)
            all_doc_keys = self.rc.keys(pattern_doc)

            total_images = len(all_image_keys)
            total_documents = len(all_doc_keys)

            # If there are no items, return
            if total_images == 0 and total_documents == 0:
                return {
                    "total_images": 0,
                    "visible_images": 0,
                    "hidden_images": 0,
                    "total_documents": 0,
                    "visible_documents": 0,
                    "hidden_documents": 0,
                    "linked_documents": 0,
                    "unlinked_documents": 0,
                    "watched_folders": len(self.watched_folders),
                }

            for key in all_image_keys:
                pipe.hget(key, "hidden")
            for key in all_doc_keys:
                pipe.hget(key, "hidden")
                pipe.hget(key, "images")  # Also get images field for link count

            results = pipe.execute()

            visible_images = 0
            hidden_images = 0

            for i in range(total_images):
                hidden_status = results[i]
                if hidden_status:
                    hidden_value = (
                        hidden_status.decode("utf-8")
                        if isinstance(hidden_status, bytes)
                        else str(hidden_status)
                    )
                    if hidden_value == "true":
                        hidden_images += 1
                    else:
                        visible_images += 1
                else:
                    # If hidden field is None/empty, consider it visible (default)
                    visible_images += 1

            visible_documents = 0
            hidden_documents = 0
            linked_documents = 0

            doc_start_index = total_images
            for i in range(total_documents):
                hidden_idx = doc_start_index + (
                    i * 2
                )  # Every 2nd result is hidden field
                images_idx = (
                    doc_start_index + (i * 2) + 1
                )  # Every 2nd+1 result is images field

                hidden_status = (
                    results[hidden_idx] if hidden_idx < len(results) else None
                )
                images_json = results[images_idx] if images_idx < len(results) else None

                if hidden_status:
                    hidden_value = (
                        hidden_status.decode("utf-8")
                        if isinstance(hidden_status, bytes)
                        else str(hidden_status)
                    )
                    if hidden_value == "true":
                        hidden_documents += 1
                    else:
                        visible_documents += 1
                else:
                    # If hidden field is None/empty, consider it visible (default)
                    visible_documents += 1

                if images_json:
                    images_str = (
                        images_json.decode("utf-8")
                        if isinstance(images_json, bytes)
                        else images_json
                    )
                    if images_str and images_str != "[]":
                        linked_documents += 1

            return {
                "total_images": total_images,
                "visible_images": visible_images,
                "hidden_images": hidden_images,
                "total_documents": total_documents,
                "visible_documents": visible_documents,
                "hidden_documents": hidden_documents,
                "linked_documents": linked_documents,
                "unlinked_documents": total_documents - linked_documents,
                "watched_folders": len(self.watched_folders),
                "watched_folder_paths": self.watched_folders,
            }
        except Exception as e:
            self.server_log(f"[ERROR] Failed to get server statistics: {e}")
            return {
                "total_images": 0,
                "visible_images": 0,
                "hidden_images": 0,
                "total_documents": 0,
                "visible_documents": 0,
                "hidden_documents": 0,
                "linked_documents": 0,
                "unlinked_documents": 0,
                "watched_folders": 0,
                "watched_folder_paths": [],
                "error": str(e),
            }

    def start_scheduler(self):
        """Start the embedding generation scheduler if configured for interval mode."""
        schedule_type = self.embedding_schedule.get("schedule_type")

        if schedule_type == "interval":
            self.scheduler_running = True
            self.scheduler_thread = threading.Thread(
                target=self._scheduler_worker, daemon=True
            )
            self.scheduler_thread.start()
            self.server_log("[INFO] Embedding generation scheduler started")
        elif schedule_type == "immediate":
            self.server_log(
                "[INFO] Immediate embedding generation mode enabled - embeddings will be generated when files are added"
            )
        else:  # manual
            self.server_log(
                "[INFO] Manual embedding generation mode - use debug menu or API to trigger generation"
            )

    def stop_scheduler(self):
        """Stop the embedding generation scheduler."""
        if self.scheduler_running:
            self.scheduler_running = False
            if self.scheduler_thread and self.scheduler_thread.is_alive():
                self.scheduler_thread.join()
            self.server_log("[INFO] Embedding generation scheduler stopped")

    def _scheduler_worker(self):
        """Background worker for scheduled embedding generation."""
        start_hour = self.embedding_schedule.get("start_hour", 1)
        interval_hours = self.embedding_schedule.get("interval_hours", 24)

        self.server_log(
            f"[INFO] Scheduler configured: start_hour={start_hour}, interval_hours={interval_hours}"
        )

        now = datetime.datetime.now()
        target_time = now.replace(hour=start_hour, minute=0, second=0, microsecond=0)

        if now >= target_time:
            target_time += datetime.timedelta(days=1)

        self.server_log(
            f"[INFO] Next embedding generation scheduled for: {target_time}"
        )

        while self.scheduler_running:
            now = datetime.datetime.now()

            if now >= target_time:
                self.server_log("[INFO] Starting scheduled embedding generation")
                try:
                    result = self.generate_embeddings()
                    self.server_log(
                        f"[INFO] Scheduled embedding generation completed: {result}"
                    )
                except Exception as e:
                    self.server_log(
                        f"[ERROR] Scheduled embedding generation failed: {e}"
                    )

                target_time += datetime.timedelta(hours=interval_hours)
                self.server_log(
                    f"[INFO] Next embedding generation scheduled for: {target_time}"
                )

            time.sleep(60)

    def generate_embeddings(self):
        """Generate embeddings for all images and documents in Redis that don't have embeddings yet."""
        try:
            # Ensure model is loaded (handles dynamic loading)
            if not self.ensure_model_loaded():
                return {
                    "success": False,
                    "error": f"Failed to load model {self.model_alias}",
                    "processed": 0,
                    "skipped": 0,
                    "errors": 0,
                }

            loaded_model = self.controller.get_model(self.model_alias)

            self.embedding_progress["active"] = True
            self.embedding_progress["start_time"] = time.time()
            self.embedding_progress["processed"] = 0
            self.embedding_progress["skipped"] = 0
            self.embedding_progress["errors"] = 0

            image_pattern = "image:*"
            image_keys = self.rc.keys(image_pattern)
            doc_pattern = "document:*"
            doc_keys = self.rc.keys(doc_pattern)

            total_items = len(image_keys) + len(doc_keys)
            self.embedding_progress["total"] = total_items
            self.embedding_progress["current"] = 0

            image_processed = 0
            image_skipped = 0
            image_errors = 0

            self.embedding_progress["stage"] = "Processing images"
            self.server_log(
                f"[INFO] Starting embedding generation for {len(image_keys)} images using model {self.model_alias}"
            )

            for key in image_keys:
                key_str = key.decode("utf-8") if isinstance(key, bytes) else key

                try:
                    existing_embedding = self.rc.hget(
                        key_str, loaded_model.embedding_name
                    )
                    if existing_embedding:
                        image_skipped += 1
                        self.embedding_progress["skipped"] += 1
                        self.embedding_progress["current"] += 1
                        continue

                    image_data = self.rc.hgetall(key_str)
                    local_path = image_data.get(b"local_path", b"").decode("utf-8")
                    is_hidden = (
                        image_data.get(b"hidden", b"false").decode("utf-8") == "true"
                    )

                    if is_hidden or not local_path or not os.path.exists(local_path):
                        image_skipped += 1
                        self.embedding_progress["skipped"] += 1
                        self.embedding_progress["current"] += 1
                        continue

                    embedding = loaded_model.generate_image_embedding(local_path)
                    if embedding is not None:
                        encoded_embedding = self.rc.embedding_encode(embedding)
                        self.rc.hset(
                            key_str, loaded_model.embedding_name, encoded_embedding
                        )
                        image_processed += 1
                        self.embedding_progress["processed"] += 1
                        # self.server_log(
                        #     f"[INFO] Generated embedding for image: {local_path}"
                        # )
                    else:
                        image_errors += 1
                        self.embedding_progress["errors"] += 1
                        self.server_log(
                            f"[ERROR] Failed to generate embedding for image: {local_path}"
                        )

                except Exception as e:
                    image_errors += 1
                    self.embedding_progress["errors"] += 1
                    self.server_log(f"[ERROR] Error processing image {key_str}: {e}")

                self.embedding_progress["current"] += 1

            doc_processed = 0
            doc_skipped = 0
            doc_errors = 0

            self.embedding_progress["stage"] = "Processing documents"
            self.server_log(
                f"[INFO] Starting embedding generation for {len(doc_keys)} documents using model {self.model_alias}"
            )

            for key in doc_keys:
                key_str = key.decode("utf-8") if isinstance(key, bytes) else key

                try:
                    existing_embedding = self.rc.hget(
                        key_str, loaded_model.embedding_name
                    )
                    if existing_embedding:
                        doc_skipped += 1
                        self.embedding_progress["skipped"] += 1
                        self.embedding_progress["current"] += 1
                        continue

                    doc_data = self.rc.hgetall(key_str)
                    title = doc_data.get(b"title", b"").decode("utf-8")
                    is_hidden = (
                        doc_data.get(b"hidden", b"false").decode("utf-8") == "true"
                    )

                    if is_hidden or not title.strip():
                        doc_skipped += 1
                        self.embedding_progress["skipped"] += 1
                        self.embedding_progress["current"] += 1
                        continue

                    # Generate text embedding using document title
                    embedding = loaded_model.generate_text_embedding(title)
                    if embedding is not None:
                        encoded_embedding = self.rc.embedding_encode(embedding)
                        self.rc.hset(
                            key_str, loaded_model.embedding_name, encoded_embedding
                        )
                        doc_processed += 1
                        self.embedding_progress["processed"] += 1
                        # self.server_log(
                        #     f"[INFO] Generated embedding for document: {title}"
                        # )
                    else:
                        doc_errors += 1
                        self.embedding_progress["errors"] += 1
                        self.server_log(
                            f"[ERROR] Failed to generate embedding for document: {title}"
                        )

                except Exception as e:
                    doc_errors += 1
                    self.embedding_progress["errors"] += 1
                    self.server_log(f"[ERROR] Error processing document {key_str}: {e}")

                self.embedding_progress["current"] += 1

            total_processed = image_processed + doc_processed
            total_skipped = image_skipped + doc_skipped
            total_errors = image_errors + doc_errors

            self.embedding_progress["stage"] = "Completed"
            self.embedding_progress["active"] = False

            result = {
                "success": True,
                "model_used": self.model_alias,
                "processed": total_processed,
                "skipped": total_skipped,
                "errors": total_errors,
                "image_processed": image_processed,
                "image_skipped": image_skipped,
                "image_errors": image_errors,
                "doc_processed": doc_processed,
                "doc_skipped": doc_skipped,
                "doc_errors": doc_errors,
                "total_images": len(image_keys),
                "total_documents": len(doc_keys),
            }

            self.server_log(
                f"[INFO] Embedding generation completed: Images: {image_processed} processed, {image_skipped} skipped, {image_errors} errors | Documents: {doc_processed} processed, {doc_skipped} skipped, {doc_errors} errors"
            )

            if total_processed > 0:
                self.try_create_index()

            return result

        except Exception as e:
            # Reset progress on error
            self.embedding_progress["active"] = False
            self.embedding_progress["stage"] = "Error"

            error_msg = f"Embedding generation failed: {e}"
            self.server_log(f"[ERROR] {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "processed": 0,
                "skipped": 0,
                "errors": 0,
            }

    def generate_image_embeddings(self):
        """
        Legacy method name for backward compatibility.
        Calls the new generate_embeddings method.
        """
        return self.generate_embeddings()

    def get_embedding_progress(self):
        """
        Get the current progress of embedding generation.

        :return: Dictionary with progress information
        """
        progress = self.embedding_progress.copy()

        if progress["total"] > 0:
            if not progress["active"] and progress["current"] > 0:
                progress["percentage"] = 100
            elif progress["active"]:
                actual_work = progress["processed"] + progress["errors"]
                progress["percentage"] = min(
                    99, (actual_work / progress["total"]) * 100
                )
            else:
                progress["percentage"] = 0
        else:
            progress["percentage"] = 0

        if progress["start_time"]:
            progress["elapsed_time"] = time.time() - progress["start_time"]
        else:
            progress["elapsed_time"] = 0

        return progress

    def trigger_embedding_generation(self):
        """Manually trigger embedding generation in background."""
        if self.embedding_progress["active"]:
            return {
                "success": False,
                "error": "Embedding generation is already in progress",
                "processed": 0,
                "skipped": 0,
                "errors": 0,
            }

        embedding_thread = threading.Thread(
            target=self._run_embedding_generation, daemon=True
        )
        embedding_thread.start()

        return {
            "success": True,
            "message": "Embedding generation started in background",
            "processed": 0,
            "skipped": 0,
            "errors": 0,
        }

    def _run_embedding_generation(self):
        """Run embedding generation in background thread."""
        try:
            self.server_log(
                f"[INFO] Starting background embedding generation with model: {self.model_alias}"
            )
            result = self.generate_embeddings()
            self.server_log(
                f"[INFO] Background embedding generation completed: {result}"
            )
        except Exception as e:
            error_msg = f"Background embedding generation failed: {e}"
            self.server_log(f"[ERROR] {error_msg}")
            # Reset progress on error
            self.embedding_progress["active"] = False
            self.embedding_progress["stage"] = "Error"

    def generate_immediate_embedding(self, redis_key):
        """
        Generate embedding immediately for a single item (image or document).
        Used when schedule_type is 'immediate'.

        :param redis_key: Redis key for the item (e.g., 'image:hash' or 'document:hash')
        :return: Boolean indicating success
        """
        if self.embedding_schedule.get("schedule_type") != "immediate":
            return False

        try:
            # Ensure model is loaded (handles dynamic loading)
            if not self.ensure_model_loaded():
                self.server_log(
                    f"[WARNING] Cannot generate immediate embedding: Failed to load model {self.model_alias}"
                )
                return False

            loaded_model = self.controller.get_model(self.model_alias)

            existing_embedding = self.rc.hget(redis_key, loaded_model.embedding_name)
            if existing_embedding:
                return True  # Already has embedding

            item_data = self.rc.hgetall(redis_key)
            if not item_data:
                return False

            is_hidden = item_data.get(b"hidden", b"false").decode("utf-8") == "true"
            if is_hidden:
                return False

            embedding = None

            if redis_key.startswith("image:"):
                local_path = item_data.get(b"local_path", b"").decode("utf-8")
                if local_path and os.path.exists(local_path):
                    embedding = loaded_model.generate_image_embedding(local_path)
                    if embedding is not None:
                        self.server_log(
                            f"[INFO] Generated immediate embedding for image: {local_path}"
                        )

            elif redis_key.startswith("document:"):
                title = item_data.get(b"title", b"").decode("utf-8")
                if title.strip():
                    embedding = loaded_model.generate_text_embedding(title)
                    if embedding is not None:
                        self.server_log(
                            f"[INFO] Generated immediate embedding for document: {title}"
                        )

            if embedding is not None:
                encoded_embedding = self.rc.embedding_encode(embedding)
                self.rc.hset(redis_key, loaded_model.embedding_name, encoded_embedding)

                self.try_create_index()
                return True
            else:
                self.server_log(
                    f"[ERROR] Failed to generate immediate embedding for: {redis_key}"
                )
                return False

        except Exception as e:
            self.server_log(
                f"[ERROR] Error generating immediate embedding for {redis_key}: {e}"
            )
            return False

    def get_embedding_schedule_status(self):
        """Get the current status of the embedding generation schedule."""
        schedule_type = self.embedding_schedule.get("schedule_type", "manual")
        status = {
            "schedule_type": schedule_type,
            "start_hour": self.embedding_schedule.get("start_hour", 1),
            "interval_hours": self.embedding_schedule.get("interval_hours", 24),
            "scheduler_running": self.scheduler_running,
            "current_model": self.model_alias,
        }

        if schedule_type == "immediate":
            status["description"] = (
                "Embeddings are generated immediately when files are added"
            )
        elif schedule_type == "interval":
            status["description"] = (
                f"Embeddings are generated every {status['interval_hours']} hours starting at {status['start_hour']}:00"
            )
        else:  # manual
            status["description"] = (
                "Embeddings are generated manually via API or debug interface"
            )

        return status

    def reset_unload_timer(self):
        """Reset the model unload timer"""
        if self.unload_timer:
            self.unload_timer.cancel()

        if self.dynamic_loading_enabled:
            self.unload_timer = threading.Timer(
                self.unload_timeout_minutes * 60, self.unload_model_after_timeout
            )
            self.unload_timer.start()

    def unload_model_after_timeout(self):
        """Unload the model after timeout period"""
        with self.model_loading_lock:
            current_time = time.time()
            if (
                self.model_last_used
                and current_time - self.model_last_used
                >= self.unload_timeout_minutes * 60
            ):
                model_status = self.controller.get_model_status(self.model_alias)
                if model_status == 2:  # ModelStatus.LOADED
                    self.server_log(
                        f"[INFO] Unloading model {self.model_alias} after {self.unload_timeout_minutes} minutes of inactivity"
                    )
                    if self.controller.unload_model(self.model_alias):
                        self.server_log(
                            f"[SUCCESS] Model {self.model_alias} unloaded successfully"
                        )
                    else:
                        self.server_log(
                            f"[ERROR] Failed to unload model {self.model_alias}"
                        )

    def ensure_model_loaded(self):
        """Ensure the model is loaded for search operations. Returns True if ready, False if loading/failed."""
        if not self.dynamic_loading_enabled:
            # If dynamic loading is disabled, model should always be loaded
            model_status = self.controller.get_model_status(self.model_alias)
            return model_status == 2  # ModelStatus.LOADED

        with self.model_loading_lock:
            model_status = self.controller.get_model_status(self.model_alias)

            if model_status == 2:  # ModelStatus.LOADED
                # Model is already loaded, update last used time and reset timer
                self.model_last_used = time.time()
                self.reset_unload_timer()
                return True

            elif model_status == 1:  # ModelStatus.LOADING
                # Model is currently loading, return False to indicate not ready
                return False

            elif model_status == 0:
                self.server_log(f"[INFO] Loading model {self.model_alias} for query")
                if self.controller.load_model(self.model_alias):
                    self.model_last_used = time.time()
                    self.reset_unload_timer()
                    self.server_log(
                        f"[SUCCESS] Model {self.model_alias} loaded successfully"
                    )
                    return True
                else:
                    self.server_log(f"[ERROR] Failed to load model {self.model_alias}")
                    return False

            return False

    def get_dynamic_loading_status(self):
        """Get the current status of dynamic model loading"""
        model_status = self.controller.get_model_status(self.model_alias)
        status_names = {0: "unloaded", 1: "loading", 2: "loaded"}

        return {
            "enabled": self.dynamic_loading_enabled,
            "unload_timeout_minutes": self.unload_timeout_minutes,
            "model_status": status_names.get(model_status, "unknown"),
            "model_last_used": self.model_last_used,
            "timer_active": self.unload_timer is not None
            and self.unload_timer.is_alive()
            if self.unload_timer
            else False,
        }

    def cleanup(self):
        """Clean up resources when shutting down the server."""
        self.server_log("[INFO] Starting server cleanup...")

        if self.unload_timer:
            self.unload_timer.cancel()

        self.stop_scheduler()

        if hasattr(self, "file_watcher"):
            self.stop_watchers()

        if hasattr(self, "log_file") and self.log_file:
            self.log_file.close()

        self.server_log("[INFO] Server cleanup completed")