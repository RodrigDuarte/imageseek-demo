import os
import json
import time
import math
import random

from redis.commands.search.query import Query
from redis.commands.search.field import VectorField, TextField

from utils.model import Model, ModelStatus
from utils.redis import RedisHelper


class Controller:
    COMPLEX_FACTOR = 0.2
    DOCUMENT_TOP_K = 10
    IMAGE_TOP_K = 10
    TEMP_TOP_K = 25

    def __init__(self, logger=None, models_config_path=None, model_alias=None):
        self.rc = None
        self.images_path = None
        self.logger = logger or print
        self.model = None
        self.model_alias = model_alias

        if model_alias:
            self._load_active_model(models_config_path, model_alias)

    def _load_active_model(self, config_path=None, model_alias=None):
        """Load the model from JSON configuration file"""
        if config_path is None:
            current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            config_path = os.path.join(current_dir, "models.json")

        if not os.path.exists(config_path):
            error_msg = f"[ERROR] Models config file not found at {config_path}"
            self.logger(error_msg)
            raise FileNotFoundError(error_msg)

        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)

            models_config = config.get("models", {})

            if model_alias not in models_config:
                error_msg = f"[ERROR] Model '{model_alias}' not found in configuration"
                self.logger(error_msg)
                raise ValueError(error_msg)

            model_data = models_config[model_alias]
            self.logger(f"[INFO] Loading active model: {model_alias}")

            try:
                self.model = Model(
                    model_type=model_data["model_type"],
                    model_name=model_data["model_name"],
                    model_pretrained=model_data.get("model_pretrained"),
                    embedding_name=model_data.get("embedding_name"),
                    embedding_length=model_data.get("embedding_length"),
                    hidden=model_data.get("hidden", False),
                    description=model_data.get("description"),
                    logger=self.logger,
                )
                self.logger(
                    f"[SUCCESS] Active model {model_alias} configured successfully"
                )

            except Exception as e:
                error_msg = f"[ERROR] Failed to create model {model_alias}: {e}"
                self.logger(error_msg)
                raise RuntimeError(error_msg)

        except (FileNotFoundError, ValueError, RuntimeError):
            raise
        except Exception as e:
            error_msg = f"[ERROR] Failed to load models config: {e}"
            self.logger(error_msg)
            raise RuntimeError(error_msg)

    def redis_connect(self, host: str = "localhost", port: int = 6379, db: int = 0):
        """Connect to Redis database with error guards"""
        try:
            self.rc = RedisHelper(host, port, db, logger=self.logger)
            if self.rc.connect():
                self.logger(f"[SUCCESS] Connected to Redis at {host}:{port}/{db}")
                return True
            else:
                self.logger(f"[ERROR] Failed to connect to Redis at {host}:{port}/{db}")
                return False
        except Exception as e:
            self.logger(f"[ERROR] Redis connection error: {e}")
            return False

    def add_model(self, model_alias: str, model_config: dict):
        """Add a new model from configuration dictionary"""
        try:
            if self.model and self.model_alias == model_alias:
                self.logger(
                    f"[WARNING] Model {model_alias} already exists, replacing it"
                )

            model = Model(
                model_type=model_config["model_type"],
                model_name=model_config["model_name"],
                model_pretrained=model_config.get("model_pretrained"),
                embedding_name=model_config.get("embedding_name"),
                embedding_length=model_config.get("embedding_length"),
                hidden=model_config.get("hidden", False),
                description=model_config.get("description"),
                logger=self.logger,
            )
            self.model = model
            self.model_alias = model_alias
            self.logger(f"[SUCCESS] Added model {model_alias}")
            return True

        except Exception as e:
            self.logger(f"[ERROR] Failed to add model {model_alias}: {e}")
            return False

    def remove_model(self, model_alias: str):
        """Remove a model from the controller"""
        if not self.model or self.model_alias != model_alias:
            self.logger(f"[ERROR] Model {model_alias} not found")
            return False

        try:
            # Unload model if it's loaded
            if self.model.loaded == ModelStatus.LOADED:
                self.model.unload_model()

            self.model = None
            self.model_alias = None
            self.logger(f"[SUCCESS] Removed model {model_alias}")
            return True

        except Exception as e:
            self.logger(f"[ERROR] Failed to remove model {model_alias}: {e}")
            return False

    def get_model(self, model_alias: str):
        """Get model by alias with improved error handling"""
        if not self.model or self.model_alias != model_alias:
            available_model = self.model_alias if self.model else "None"
            self.logger(
                f"[ERROR] Model '{model_alias}' not found. Available model: {available_model}"
            )
            return None
        return self.model

    def get_model_info(self, model_alias: str):
        """Get detailed information about a model"""
        model = self.get_model(model_alias)
        if not model:
            return None

        from utils.model import ModelType

        return {
            "alias": model_alias,
            "model_type": ModelType.get_name_from_type(model.model_type),
            "model_name": model.model_name,
            "model_pretrained": model.model_pretrained,
            "embedding_name": model.embedding_name,
            "hidden": model.hidden,
            "description": model.description,
            "status": model.loaded,
            "device": model.device,
        }

    def set_images_path(self, images_path: str):
        """Set the path for images"""
        if not os.path.exists(images_path):
            self.logger(f"[WARNING] Images path does not exist: {images_path}")
        self.images_path = images_path
        self.logger(f"[INFO] Images path set to: {images_path}")

    def list_models(self, include_hidden: bool = False):
        """List available models with option to include hidden ones"""
        models = []
        if self.model and (include_hidden or not self.model.hidden):
            models.append(self.model_alias)
        return models

    def load_model(self, model_alias: str):
        """Load a model with improved error handling"""
        model = self.get_model(model_alias)
        if not model:
            return False
        return model.load_model()

    def unload_model(self, model_alias: str):
        """Unload a model with improved error handling"""
        model = self.get_model(model_alias)
        if not model:
            return False
        return model.unload_model()

    def toggle_model(self, model_alias: str):
        """Toggle model load/unload state"""
        model = self.get_model(model_alias)
        if not model:
            return False

        if model.loaded == ModelStatus.LOADING:
            self.logger(f"[WARNING] Model {model_alias} is currently loading")
            return False

        if model.loaded == ModelStatus.LOADED:
            return model.unload_model()
        elif model.loaded == ModelStatus.UNLOADED:
            return model.load_model()

        return False

    def get_model_status(self, model_alias: str):
        """Get the status of a specific model"""
        model = self.get_model(model_alias)
        if not model:
            return None
        return model.loaded

    def get_models_status(self, include_hidden: bool = False):
        """Get status of all models"""
        status = {}
        if self.model and (include_hidden or not self.model.hidden):
            status[self.model_alias] = self.model.loaded
        return status

    def recreate_indexes(self, model_alias: str):
        """
        Recreate indexes to include the hidden field.
        This is needed when upgrading from indexes without the hidden field.
        """
        model = self.get_model(model_alias)
        if not model:
            return False

        try:
            image_index_name = f"idx:image:{model.embedding_name}"
            document_index_name = f"idx:document:{model.embedding_name}"

            try:
                self.rc.ft(image_index_name).dropindex()
                self.logger(f"[INFO] Dropped existing image index: {image_index_name}")
            except Exception:
                self.logger(f"[INFO] Image index {image_index_name} did not exist")

            try:
                self.rc.ft(document_index_name).dropindex()
                self.logger(
                    f"[INFO] Dropped existing document index: {document_index_name}"
                )
            except Exception:
                self.logger(
                    f"[INFO] Document index {document_index_name} did not exist"
                )

            self.index("image:", [TextField(name="hidden")], model_alias, mute=False)
            self.index("document:", [TextField(name="hidden")], model_alias, mute=False)

            self.logger("[SUCCESS] Indexes recreated with hidden field support")
            return True

        except Exception as e:
            self.logger(f"[ERROR] Failed to recreate indexes: {e}")
            return False

    def index(
        self,
        document_prefix: str,
        returning_fields: list,
        model_alias: str,
        mute: bool = True,
    ):
        """Creates index for documents with embeddings"""
        if not self.rc:
            self.logger("[ERROR] Redis not connected")
            return False

        model = self.get_model(model_alias)
        if not model:
            return False

        try:
            document_keys = self.rc.keys(f"{document_prefix}*")
            document_keys_len = len(document_keys)

            if document_keys_len == 0:
                self.logger(
                    f"[ERROR] No documents found with prefix '{document_prefix}'. Cannot create index."
                )
                return False

            embedding_data = self.rc.hget(document_keys[0], model.embedding_name)
            if embedding_data is None:
                self.logger(
                    f"[ERROR] No embedding found in first document for model '{model_alias}'. Cannot create index."
                )
                return False

            h, w = self.rc.embedding_decode(embedding_data).shape
            vector_dimension = w + 2  # Add 2 floats for h and w

            index_name = f"idx:{document_prefix}{model.embedding_name}"
            vector_field = model.embedding_name

            embedding_field = VectorField(
                vector_field,
                "FLAT",
                {
                    "TYPE": "FLOAT32",
                    "DIM": vector_dimension,
                    "DISTANCE_METRIC": "COSINE",
                    "INITIAL_CAP": document_keys_len,
                },
            )

            fields = [*returning_fields, embedding_field]

            self.rc.create_new_index(index_name, document_prefix, fields, mute)

            self.logger(
                f"[SUCCESS] Created index {index_name} with {document_keys_len} documents"
            )

            return True

        except Exception as e:
            self.logger(f"[ERROR] Index creation failed: {e}")
            return False

    def _perform_search(
        self, model_alias: str, query: str, search_config: dict, top_k: int = 5
    ):
        """Common search function to reduce code duplication"""
        model = self.get_model(model_alias)
        if not model:
            return None

        if model.loaded != ModelStatus.LOADED:
            self.logger(f"[ERROR] Model {model_alias} not loaded")
            return None

        if not self.rc:
            self.logger("[ERROR] Redis not connected")
            return None

        try:
            text_embedding = model.generate_text_embedding(query)
            if text_embedding is None:
                self.logger(
                    f"[ERROR] Failed to generate text embedding for query: {query}"
                )
                return None

            text_embedding_encoded = self.rc.embedding_encode(text_embedding)

            vector_field = model.embedding_name
            index_name = search_config["index_name"].format(vector_field=vector_field)
            return_fields = search_config["return_fields"]

            redis_query = (
                Query(
                    f"(-@hidden:true)=>[KNN {top_k} @{vector_field} $vector as score]"
                )
                .return_fields("score", *return_fields)
                .sort_by("score")
                .paging(0, top_k)
                .dialect(2)
            )

            query_params = {"vector": text_embedding_encoded}

            results = self.rc.ft(index_name).search(redis_query, query_params)
            self.logger(
                f"[SUCCESS] Search completed. Found {len(results.docs)} results"
            )
            return results

        except Exception as e:
            self.logger(f"[ERROR] Search failed: {e}")
            return None

    def search(self, model_alias: str, query: str, top_k: int = 5):
        """Search images"""
        search_config = {
            # "index_name": "idx:evaluation:image:{vector_field}",
            "index_name": "idx:image:{vector_field}",
            "return_fields": ["hash", "url", "extension"],
        }
        return self._perform_search(model_alias, query, search_config, top_k)

    def search_documents(self, model_alias: str, query: str, top_k: int = 5):
        """Search documents"""
        search_config = {
            # "index_name": "idx:evaluation:document:{vector_field}",
            "index_name": "idx:document:{vector_field}",
            "return_fields": ["url", "content", "date", "images"],
        }
        return self._perform_search(model_alias, query, search_config, top_k)

    def search_rag_style(self, model_alias: str, query: str, top_k: int = 20):
        """Search in RAG style"""
        search_config = {
            "index_name": "idx:document:{vector_field}",
            "return_fields": ["url", "content", "date", "images"],
        }
        return self._perform_search(model_alias, query, search_config, top_k)

    def search_complex(
        self, model_alias: str, query: str, top_k: int = 5, function_option: int = 1
    ):
        """Search using complex method"""
        # Search with text embeddings
        search_config_text = {
            "index_name": "idx:document:{vector_field}",
            "return_fields": ["images"],
        }

        model = self.get_model(model_alias)

        results_text = self._perform_search(
            model_alias, query, search_config_text, self.DOCUMENT_TOP_K
        )
        if not results_text or len(results_text.docs) == 0:
            self.logger(f"[ERROR] No results found for query: {query}")
            return []

        # Create temporary index for images collected from articles
        temp = random.randint(2**32, 2**33)
        temp_prefix = f"temp:{temp}:"
        temp_index_name = f"idx:{temp_prefix}{model.embedding_name}"

        multiplier = {}
        for res in results_text.docs:
            try:
                images_str = getattr(res, "images", "[]")
                if not images_str or images_str.strip() == "":
                    images_str = "[]"

                images = (
                    json.loads(images_str)
                    if isinstance(images_str, str)
                    else images_str
                )
                if not isinstance(images, list):
                    self.logger(
                        f"[WARNING] Images field is not a list for document {getattr(res, 'id', 'unknown')}: {type(images)}"
                    )
                    continue

                for img in images:
                    if not isinstance(img, dict) or "hash" not in img:
                        self.logger(f"[WARNING] Invalid image reference format: {img}")
                        continue

                    img_hash = img["hash"]
                    if not img_hash:
                        self.logger(f"[WARNING] Empty image hash: {img}")
                        continue

                    img_key_to_check = f"image:{img_hash}"
                    temp_img_key = f"{temp_prefix}{img_hash}"

                    if self.rc.exists(img_key_to_check):
                        hidden_status = self.rc.hget(img_key_to_check, "hidden")
                        if hidden_status:
                            hidden_value = (
                                hidden_status.decode("utf-8")
                                if isinstance(hidden_status, bytes)
                                else str(hidden_status)
                            )
                            if hidden_value == "true":
                                continue  # Skip hidden images

                        self.rc.copy(img_key_to_check, temp_img_key)
                        multiplier[temp_img_key] = float(getattr(res, "score", 0.0))
                    else:
                        self.logger(
                            f"[WARNING] Image key does not exist: {img_key_to_check}"
                        )

            except json.JSONDecodeError as e:
                self.logger(
                    f"[ERROR] Failed to parse images JSON for document {getattr(res, 'id', 'unknown')}: {e}"
                )
                self.logger(
                    f"[ERROR] Images content: {repr(getattr(res, 'images', 'missing'))}"
                )
                continue
            except Exception as e:
                self.logger(
                    f"[ERROR] Unexpected error processing images for document {getattr(res, 'id', 'unknown')}: {e}"
                )
                continue

        if not multiplier:
            self.logger(
                "[WARNING] No valid images found for complex search, falling back to regular search"
            )
            return {}

        self.index(temp_prefix, [TextField(name="hidden")], model_alias, mute=True)

        time.sleep(1)  # Wait for index to be created

        search_config_temp = {
            "index_name": temp_index_name,
            "return_fields": ["hash"],
        }

        results_temp = self._perform_search(
            model_alias, query, search_config_temp, self.TEMP_TOP_K
        )

        text_results = []
        for res in results_temp.docs:
            base_score = float(getattr(res, "score", 0.0))
            multiplier_value = multiplier.get(getattr(res, "id", ""), 1.0)
            final_score = base_score
            text_results.append(
                {
                    "hash": getattr(res, "hash", ""),
                    "base_score": base_score,
                    "multiplier": multiplier_value,
                    "final_score": final_score,
                }
            )

        text_results.sort(key=lambda x: x["final_score"])

        # Clean up temporary index and keys
        self.rc.ft(temp_index_name).dropindex()
        [self.rc.delete(key) for key in self.rc.keys(f"{temp_prefix}*")]

        # Image only retrieval
        search_config_image = {
            "index_name": "idx:image:{vector_field}",
            "return_fields": ["hash"],
        }

        results_image = self._perform_search(
            model_alias, query, search_config_image, self.IMAGE_TOP_K
        )

        image_results = []
        for res in results_image.docs:
            image_results.append(
                {
                    "hash": getattr(res, "hash", ""),
                    "base_score": float(getattr(res, "score", 0.0)),
                    "multiplier": 1.0,
                    "final_score": float(getattr(res, "score", 0.0)),
                }
            )

        distance = text_results[0]["final_score"] - image_results[0]["final_score"]

        for _, res in enumerate(text_results):
            if function_option == 1:
                res["final_score"] -= distance * (1 - (self.COMPLEX_FACTOR * _))
            elif function_option == 2:
                res["final_score"] -= distance * (1 - (self.COMPLEX_FACTOR * (_ + 1)))
            elif function_option == 3:
                res["final_score"] -= distance * (
                    1 - (self.COMPLEX_FACTOR ** math.sqrt(_))
                )
            elif function_option == 4:
                res["final_score"] -= distance * (
                    1 - (self.COMPLEX_FACTOR ** math.exp(_))
                )
            else:
                res["final_score"] -= distance * (1 - (self.COMPLEX_FACTOR * _))

        combined_results = text_results + image_results

        # Remove duplicates based on 'hash' in reverse order
        # to keep the first occurence (has lowest score)
        seen_hashes = set()
        combined_results = [
            res
            for res in reversed(combined_results)
            if not (res["hash"] in seen_hashes or seen_hashes.add(res["hash"]))
        ]
        sorted_combined_results = sorted(
            combined_results, key=lambda x: x["final_score"]
        )

        return sorted_combined_results[:top_k] if top_k > 0 else sorted_combined_results
