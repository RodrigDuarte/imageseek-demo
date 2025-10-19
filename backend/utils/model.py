import os
import numpy as np

from PIL import Image
from PIL import ImageFile

# AI imports will be loaded dynamically when needed
import torch


class ModelType:
    CLIP = 0
    MULTILINGUAL_CLIP = 1
    OPEN_CLIP = 2
    OPEN_CLIP_FINE_TUNED = 3
    BLIP2 = 4
    SIGLIP = 5
    BERTIMBAU = 6
    ALBERTINA = 7

    # Human-readable mapping (ease of use)
    TYPE_NAMES = {
        "clip": CLIP,
        "multilingual_clip": MULTILINGUAL_CLIP,
        "open_clip": OPEN_CLIP,
        "open_clip_fine_tuned": OPEN_CLIP_FINE_TUNED,
        "blip2": BLIP2,
        "siglip": SIGLIP,
        "bertimbau": BERTIMBAU,
        "albertina": ALBERTINA,
    }

    @classmethod
    def get_type_from_name(cls, type_name):
        """Convert human-readable model type name to numeric value"""
        if isinstance(type_name, int):
            return type_name

        type_name = type_name.lower()
        if type_name in cls.TYPE_NAMES:
            return cls.TYPE_NAMES[type_name]

        raise ValueError(
            f"Unknown model type: {type_name}. Supported types: {list(cls.TYPE_NAMES.keys())}"
        )

    @classmethod
    def get_name_from_type(cls, type_value):
        """Convert numeric model type to human-readable name"""
        for name, value in cls.TYPE_NAMES.items():
            if value == type_value:
                return name
        raise ValueError(f"Unknown model type value: {type_value}")


class ModelStatus:
    UNLOADED = 0
    LOADING = 1
    LOADED = 2


class EmbeddingType:
    IMAGE = 0
    TEXT = 1


class Model:
    def __init__(
        self,
        model_type,
        model_name: str,
        model_pretrained: str = None,
        embedding_name: str = None,
        embedding_type: np.dtype = np.float32,
        embedding_length: int = None,
        hidden: bool = False,
        description: str = None,
        logger=None,
    ):
        try:
            self.model_type = ModelType.get_type_from_name(model_type)
        except ValueError as e:
            if logger:
                logger(f"[ERROR] {e}")
            raise

        # Model properties
        self.model_name = model_name
        self.model_pretrained = model_pretrained
        self.embedding_name = embedding_name or model_name.replace("/", "").replace(
            "-", ""
        )
        self.embedding_type = embedding_type
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.hidden = hidden
        self.description = description or f"Model: {model_name}"
        self.logger = logger or print

        # For the actual model, depending on the model type
        self.model = None
        self.processor = None
        self.tokenizer = None
        self.loaded = ModelStatus.UNLOADED

        # For models that have different embedding lengths
        self.embedding_length = embedding_length

        # Configure environment
        os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
        os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
        ImageFile.LOAD_TRUNCATED_IMAGES = True

    def list_supported_models():
        return {
            ModelType.CLIP: "CLIP",
            ModelType.MULTILINGUAL_CLIP: "MultilingualCLIP",
            ModelType.OPEN_CLIP: "OpenCLIP",
            ModelType.OPEN_CLIP_FINE_TUNED: "OpenCLIP fine-tuned",
            ModelType.BLIP2: "BLIP-2",
            ModelType.SIGLIP: "SigLip",
            ModelType.BERTIMBAU: "Bertimbau",
            ModelType.ALBERTINA: "Albertina",
        }

    def load_model(self):
        """Load the model"""
        model_type_name = ModelType.get_name_from_type(self.model_type)
        self.logger(f"[INFO] Loading {model_type_name} model: {self.model_name}")

        if self.loaded == ModelStatus.LOADED:
            self.logger(f"[WARNING] Model {self.model_name} already loaded")
            return True
        if self.loaded == ModelStatus.LOADING:
            self.logger(f"[WARNING] Model {self.model_name} is currently loading")
            return False

        try:
            self.loaded = ModelStatus.LOADING

            if self.model_type == ModelType.CLIP:
                self._load_clip_model()

            elif self.model_type == ModelType.MULTILINGUAL_CLIP:
                self._load_multilingual_clip_model()

            elif self.model_type == ModelType.OPEN_CLIP:
                self._load_open_clip_model()

            elif self.model_type == ModelType.OPEN_CLIP_FINE_TUNED:
                self._load_open_clip_fine_tuned_model()

            elif self.model_type == ModelType.BLIP2:
                self._load_blip2_model()

            elif self.model_type == ModelType.SIGLIP:
                self._load_siglip_model()

            elif self.model_type == ModelType.BERTIMBAU:
                self._load_bertimbau_model()

            elif self.model_type == ModelType.ALBERTINA:
                self._load_albertina_model()

            else:
                raise ValueError(f"Unsupported model type: {model_type_name}")

            self.loaded = ModelStatus.LOADED
            self.logger(f"[SUCCESS] Model {self.model_name} loaded successfully")
            return True

        except ImportError as e:
            self.loaded = ModelStatus.UNLOADED
            self.logger(f"[ERROR] Missing dependency for {model_type_name}: {e}")
            return False
        except FileNotFoundError as e:
            self.loaded = ModelStatus.UNLOADED
            self.logger(f"[ERROR] Model file not found: {e}")
            return False
        except Exception as e:
            self.loaded = ModelStatus.UNLOADED
            self.logger(f"[ERROR] Failed to load model {self.model_name}: {e}")
            return False

    def _load_clip_model(self):
        """Load CLIP model"""
        import clip

        self.model, self.processor = clip.load(self.model_name, device=self.device)

    def _load_multilingual_clip_model(self):
        """Load Multilingual CLIP model"""
        from multilingual_clip.pt_multilingual_clip import MultilingualCLIP
        from transformers import AutoTokenizer

        self.model = MultilingualCLIP.from_pretrained(self.model_name)
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)

    def _load_open_clip_model(self):
        """Load OpenCLIP model"""
        import open_clip

        self.model, _, self.processor = open_clip.create_model_and_transforms(
            self.model_name, self.model_pretrained, device=self.device
        )
        self.model.eval()  # model in train mode by default
        self.tokenizer = open_clip.get_tokenizer(self.model_name)

    def _load_open_clip_fine_tuned_model(self):
        """Load fine-tuned OpenCLIP model"""
        import open_clip

        self.model, self.processor = open_clip.create_model_from_pretrained(
            self.model_name,
            self.model_pretrained,
            load_weights_only=False,
            device=self.device,
        )
        self.model.eval()  # model in train mode by default
        self.tokenizer = open_clip.get_tokenizer(self.model_name)

    def _load_blip2_model(self):
        """Load BLIP-2 model"""
        from transformers import (
            Blip2VisionModelWithProjection,
            Blip2TextModelWithProjection,
            AutoProcessor,
        )

        self.model = [None, None]
        self.model[0] = Blip2VisionModelWithProjection.from_pretrained(self.model_name)
        self.model[0].to(self.device)
        self.model[1] = Blip2TextModelWithProjection.from_pretrained(self.model_name)
        self.model[1].to(self.device)
        self.processor = AutoProcessor.from_pretrained(self.model_name)
        self.tokenizer = "OK"

    def _load_siglip_model(self):
        """Load SigLIP model"""
        from transformers import (
            SiglipTokenizer,
            SiglipTextModel,
            SiglipVisionModel,
            SiglipImageProcessor,
        )

        self.model = [None, None]
        self.model[0] = SiglipVisionModel.from_pretrained(self.model_name)
        self.model[0].to(self.device)
        self.model[1] = SiglipTextModel.from_pretrained(self.model_name)
        self.model[1].to(self.device)
        self.tokenizer = SiglipTokenizer.from_pretrained(self.model_name)
        self.processor = SiglipImageProcessor.from_pretrained(self.model_name)

    def _load_bertimbau_model(self):
        """Load BERTimbau model"""
        from transformers import BertTokenizer, BertModel

        self.model = BertModel.from_pretrained(self.model_name)
        self.tokenizer = BertTokenizer.from_pretrained(self.model_name)
        self.model.to(self.device)
        self.processor = "OK"

    def _load_albertina_model(self):
        """Load Albertina model"""
        from transformers import AutoTokenizer, AutoModel

        self.model = AutoModel.from_pretrained(self.model_name)
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model.to(self.device)
        self.processor = "OK"

    def unload_model(self):
        self.logger(f"[INFO] Unloading model {self.model_name}...")
        if self.loaded == ModelStatus.UNLOADED:
            self.logger(f"[ERROR] Model {self.model_name} not loaded")
            return False
        if self.loaded == ModelStatus.LOADING:
            self.logger(f"[ERROR] Model {self.model_name} still loading")
            return False

        del self.model
        del self.processor
        del self.tokenizer
        self.model = None
        self.processor = None
        self.tokenizer = None
        self.loaded = ModelStatus.UNLOADED
        self.logger(f"[INFO] Model {self.model_name} unloaded successfully")
        return True

    def average_pool(self, embedding: np.ndarray, target_dim: int):
        current_dim = embedding.shape[1]
        num_pools = current_dim // target_dim

        if num_pools == 0:
            raise ValueError(
                f"Cannot reduce {current_dim} to {target_dim} using average pooling"
            )

        pooled = []
        for i in range(embedding.shape[0]):
            x = embedding[i]
            # Reshape and pool
            x_reshaped = x[: num_pools * target_dim].reshape(-1, target_dim)
            pooled.append(np.mean(x_reshaped, axis=0))

        return np.array(pooled)

    def generate_image_embedding(self, image_path: str):
        if self.model is None or self.processor is None:
            self.logger(f"[ERROR] Model {self.model_name} not loaded")
            return None

        image = Image.open(image_path)

        if self.model_type == ModelType.CLIP:
            image_processed = self.processor(image).unsqueeze(0).to(self.device)
            with torch.no_grad():
                image_embedding = self.model.encode_image(image_processed)
                image_embedding /= image_embedding.norm(dim=-1, keepdim=True)

        elif self.model_type == ModelType.MULTILINGUAL_CLIP:
            self.logger(
                f"[ERROR] Model type {self.model_type} does not generate image embeddings"
            )
            return None

        elif (
            self.model_type == ModelType.OPEN_CLIP
            or self.model_type == ModelType.OPEN_CLIP_FINE_TUNED
        ):
            image_processed = self.processor(image).unsqueeze(0).to(self.device)
            with torch.no_grad():
                image_embedding = self.model.encode_image(image_processed)
                image_embedding /= image_embedding.norm(dim=-1, keepdim=True)

        elif self.model_type == ModelType.BLIP2:
            image_processed = self.processor(images=image, return_tensors="pt").to(
                self.device
            )
            with torch.no_grad():
                image_embedding = self.model[0](
                    **image_processed
                ).image_embeds.squeeze()
                image_embedding = image_embedding / image_embedding.norm(
                    dim=-1, keepdim=True
                )
            image_embedding = (
                image_embedding.detach()
                .cpu()
                .numpy()
                .astype(self.embedding_type)
                .reshape(1, -1)
            )
            image_embedding = self.average_pool(image_embedding, self.embedding_length)
            return image_embedding

        elif self.model_type == ModelType.SIGLIP:
            image_processed = self.processor(images=image, return_tensors="pt").to(
                self.device
            )
            with torch.no_grad():
                image_embedding = self.model[0](**image_processed)
                image_embedding = image_embedding.pooler_output.squeeze()
            return (
                image_embedding.detach()
                .cpu()
                .numpy()
                .astype(self.embedding_type)
                .reshape(1, -1)
            )

        elif (
            self.model_type == ModelType.BERTIMBAU
            or self.model_type == ModelType.ALBERTINA
        ):
            self.logger(
                f"[ERROR] Model type {self.model_type} does not generate image embeddings"
            )
            return None

        else:
            self.logger(f"[ERROR] Model type {self.model_type} not supported")
            return None

        return image_embedding.detach().cpu().numpy().astype(self.embedding_type)

    def generate_text_embedding(self, text: str):
        if self.model is None or self.tokenizer is None:
            self.logger(f"[ERROR] Model {self.model_name} not loaded")
            return None

        if not ModelStatus.LOADED:
            self.logger(f"[ERROR] Model {self.model_name} not loaded")
            return None

        if self.model_type == ModelType.CLIP:
            import clip

            text_tokenized = clip.tokenize([text]).to(self.device)
            with torch.no_grad():
                text_embedding = self.model.encode_text(text_tokenized)
                text_embedding /= text_embedding.norm(dim=-1, keepdim=True)

        elif self.model_type == ModelType.MULTILINGUAL_CLIP:
            text_embedding = self.model.forward([text], self.tokenizer)

        elif (
            self.model_type == ModelType.OPEN_CLIP
            or self.model_type == ModelType.OPEN_CLIP_FINE_TUNED
        ):
            text_tokenized = self.tokenizer([text]).to(self.device)
            with torch.no_grad():
                text_embedding = self.model.encode_text(text_tokenized)
                text_embedding /= text_embedding.norm(dim=-1, keepdim=True)

        elif self.model_type == ModelType.BLIP2:
            text_tokenized = self.processor(text=[text], return_tensors="pt").to(
                self.device
            )
            with torch.no_grad():
                text_embedding = self.model[1](**text_tokenized)
                text_embedding = text_embedding.text_embeds.squeeze()
                text_embedding = text_embedding / text_embedding.norm(
                    dim=-1, keepdim=True
                )
            text_embedding = (
                text_embedding.detach()
                .cpu()
                .numpy()
                .astype(self.embedding_type)
                .reshape(1, -1)
            )
            text_embedding = self.average_pool(text_embedding, self.embedding_length)
            return text_embedding

        elif self.model_type == ModelType.SIGLIP:
            text_tokenized = self.tokenizer(
                [text], padding="max_length", truncation=True, return_tensors="pt"
            ).to(self.device)
            with torch.no_grad():
                text_embedding = self.model[1](**text_tokenized)
                text_embedding = text_embedding.pooler_output.squeeze()
            return (
                text_embedding.detach()
                .cpu()
                .numpy()
                .astype(self.embedding_type)
                .reshape(1, -1)
            )

        elif (
            self.model_type == ModelType.BERTIMBAU
            or self.model_type == ModelType.ALBERTINA
        ):
            text_tokenized = self.tokenizer(
                text, padding=True, truncation=True, return_tensors="pt"
            ).to(self.device)
            text_embedding = self.model(**text_tokenized)
            text_embedding = text_embedding.last_hidden_state.mean(dim=1)
            text_embedding = text_embedding / text_embedding.norm(dim=-1, keepdim=True)

            text_embedding = (
                text_embedding.detach()
                .cpu()
                .numpy()
                .astype(self.embedding_type)
                .reshape(1, -1)
            )

            return text_embedding

        else:
            print(f"[ERROR] Model type {self.model_type} not supported")
            return None

        return text_embedding.detach().cpu().numpy().astype(self.embedding_type)
