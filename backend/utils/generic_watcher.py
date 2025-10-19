import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from utils.image_watcher import ImageWatcher
from utils.document_watcher import DocumentWatcher


class GenericWatcherEventHandler(FileSystemEventHandler):
    def __init__(self, server_instance):
        self.server = server_instance

        # Initialize specific watchers
        self.image_watcher = ImageWatcher(server_instance)
        self.document_watcher = DocumentWatcher(server_instance)

        self.watchers = [self.image_watcher, self.document_watcher]

    def _get_handler_for_file(self, file_path):
        """Get the appropriate handler for a file based on its extension."""
        for watcher in self.watchers:
            if watcher.can_handle(file_path):
                return watcher
        return None

    def on_created(self, event):
        if event.is_directory:
            return

        self.server.server_log(f"[WATCHER EVENT] File created: {event.src_path}")

        handler = self._get_handler_for_file(event.src_path)
        if handler:
            handler.process_file(event.src_path, "created")

    def on_deleted(self, event):
        if event.is_directory:
            return

        self.server.server_log(f"[WATCHER EVENT] File deleted: {event.src_path}")

        handler = self._get_handler_for_file(event.src_path)
        if handler:
            handler.remove_file(event.src_path)

    def on_modified(self, event):
        if event.is_directory:
            return

        self.server.server_log(f"[WATCHER EVENT] File modified: {event.src_path}")

        handler = self._get_handler_for_file(event.src_path)
        if handler:
            handler.process_file(event.src_path, "modified")

    def on_moved(self, event):
        if event.is_directory:
            return

        self.server.server_log(
            f"[WATCHER EVENT] File moved from {event.src_path} to {event.dest_path}"
        )

        # Handle both source and destination
        old_handler = self._get_handler_for_file(event.src_path)
        new_handler = self._get_handler_for_file(event.dest_path)

        if old_handler and new_handler and old_handler == new_handler:
            old_handler.update_file_path(event.src_path, event.dest_path)
        else:
            # Different file types or handlers, treat as delete + create
            if old_handler:
                old_handler.remove_file(event.src_path)
            if new_handler:
                new_handler.process_file(event.dest_path, "created")

    def on_any_event(self, event):
        if event.is_directory:
            return


class GenericFileWatcher:
    def __init__(self, server_instance, watch_directories):
        self.server = server_instance
        self.watch_directories = watch_directories if watch_directories else []
        self.observers = []
        self.handler = GenericWatcherEventHandler(server_instance)

    def start(self):
        """Start watching for file changes."""
        if not self.watch_directories:
            self.server.server_log("[WARNING] No watch directories configured")
            return

        for directory in self.watch_directories:
            if os.path.exists(directory):
                observer = Observer()
                observer.schedule(self.handler, directory, recursive=True)
                observer.start()
                self.observers.append(observer)
                self.server.server_log(
                    f"[INFO] Started watching directory: {directory}"
                )
            else:
                self.server.server_log(
                    f"[WARNING] Watch directory does not exist: {directory}"
                )

        self.server.server_log("[INFO] Generic file watcher started")

    def stop(self):
        """Stop watching for file changes."""
        for observer in self.observers:
            observer.stop()
            observer.join()
        self.server.server_log("[INFO] Generic file watcher stopped")

    def scan_existing_files(self):
        """Scan and process existing files in watch directories."""
        total_processed = 0

        self.server.server_log("[INFO] Starting efficient file scanning...")

        # Get all file lists first
        image_files = []
        document_files = []

        for folder in self.watch_directories:
            if not os.path.exists(folder):
                continue

            self.server.server_log(f"[INFO] Scanning directory structure: {folder}")

            for root, dirs, files in os.walk(folder):
                for file in files:
                    file_path = os.path.join(root, file)

                    for watcher in self.handler.watchers:
                        if watcher.can_handle(file_path):
                            if hasattr(watcher, "image_extensions"):  # ImageWatcher
                                image_files.append(file_path)
                            elif hasattr(
                                watcher, "document_extensions"
                            ):  # DocumentWatcher
                                document_files.append(file_path)
                            break

        self.server.server_log(
            f"[INFO] Found {len(image_files)} images and {len(document_files)} documents to process"
        )

        # Process documents first (faster)
        if document_files:
            self.server.server_log("[INFO] Processing documents...")
            doc_watcher = None
            for watcher in self.handler.watchers:
                if hasattr(watcher, "document_extensions"):
                    doc_watcher = watcher
                    break

            if doc_watcher:
                doc_processed = self._process_files_batch(
                    doc_watcher, document_files, "documents"
                )
                total_processed += doc_processed

        # Process images in batches to avoid blocking
        if image_files:
            self.server.server_log("[INFO] Processing images in batches...")
            img_watcher = None
            for watcher in self.handler.watchers:
                if hasattr(watcher, "image_extensions"):
                    img_watcher = watcher
                    break

            if img_watcher:
                img_processed = self._process_files_batch(
                    img_watcher, image_files, "images"
                )
                total_processed += img_processed

        self._run_bulk_resolution()

        self.server.server_log(
            f"[INFO] File scan completed. Total processed: {total_processed} files"
        )
        return total_processed

    def _process_files_batch(self, watcher, files, file_type):
        """Process files in batches to avoid blocking."""
        processed_count = 0
        batch_size = 100
        total_files = len(files)

        for i in range(0, total_files, batch_size):
            batch = files[i : i + batch_size]
            batch_end = min(i + batch_size, total_files)

            self.server.server_log(
                f"[INFO] Processing {file_type} batch {i // batch_size + 1}: "
                f"files {i + 1}-{batch_end} of {total_files}"
            )

            for file_path in batch:
                try:
                    if file_type == "documents":
                        if watcher._process_single_document(file_path):
                            processed_count += 1
                    else:  # images
                        if watcher._process_single_image(file_path):
                            processed_count += 1

                except Exception as e:
                    self.server.server_log(
                        f"[ERROR] Failed to process {file_type[:-1]} {file_path}: {e}"
                    )

            # Small delay between batches to allow other operations
            time.sleep(0.1)

        self.server.server_log(
            f"[INFO] {file_type.capitalize()} processing completed. Processed {processed_count} {file_type}"
        )
        return processed_count

    def _run_bulk_resolution(self):
        """Run bulk resolution after all files are processed."""
        try:
            self.server.server_log("[INFO] Running bulk image-document resolution...")

            doc_watcher = None
            for watcher in self.handler.watchers:
                if hasattr(watcher, "document_extensions"):
                    doc_watcher = watcher
                    break

            if doc_watcher:
                result = doc_watcher.bulk_resolve_unresolved_images()
                if result["success"]:
                    self.server.server_log(f"[INFO] {result['message']}")
                else:
                    self.server.server_log(
                        f"[ERROR] Bulk resolution failed: {result['error']}"
                    )
            else:
                self.server.server_log(
                    "[WARNING] Document watcher not found for bulk resolution"
                )

        except Exception as e:
            self.server.server_log(f"[ERROR] Bulk resolution failed: {e}")
