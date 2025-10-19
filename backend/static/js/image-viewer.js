const image_viewer = document.getElementById('image_viewer');
const image_viewer_overlay = document.getElementById('image_viewer_overlay');
const image_viewer_content = document.querySelector('.image-viewer-content');
const image_viewer_close = document.getElementById('image_viewer_close');
const image_viewer_title = document.getElementById('image_viewer_title');
const image_viewer_image = document.getElementById('image_viewer_image');
const image_viewer_document_details = document.getElementById('image_viewer_document_details');
const document_title = document.getElementById('document_title');
const document_content = document.getElementById('document_content');
const document_url_btn = document.getElementById('document_url_btn');

let is_image_viewer_open = false;

document.addEventListener('DOMContentLoaded', function() {
    initialize_image_viewer();
});

function initialize_image_viewer() {
    setup_image_viewer_event_listeners();
    setup_result_item_listeners();
}

function setup_image_viewer_event_listeners() {
    image_viewer_close.addEventListener('click', function() {
        close_image_viewer();
    });
    
    image_viewer_overlay.addEventListener('click', function() {
        close_image_viewer();
    });
    
    image_viewer_content.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && is_image_viewer_open) {
            close_image_viewer();
        }
    });
}

function setup_result_item_listeners() {
    document.addEventListener('click', function(e) {
        const result_item = e.target.closest('.result-item');
        if (result_item) {
            const img = result_item.querySelector('.result-image img');
            if (img) {
                const title = extract_image_title(result_item);
                const image_hash = extract_image_hash(result_item, img);
                open_image_viewer(img.src, title, image_hash);
            }
        }
    });
}

function extract_image_title(result_item) {
    const title_element = result_item.querySelector('.result-title');
    if (title_element) {
        return title_element.textContent.trim();
    }
    
    const info_element = result_item.querySelector('.result-info');
    if (info_element) {
        return info_element.textContent.trim();
    }
    
    return 'Image';
}

function extract_image_hash(result_item, img) {
    const hash_from_data = result_item.getAttribute('data-hash');
    if (hash_from_data) {
        return hash_from_data;
    }
    
    const img_src = img.src;
    const hash_match = img_src.match(/\/image\/([a-f0-9]+)/);
    if (hash_match) {
        return hash_match[1];
    }
    
    const img_alt = img.alt;
    if (img_alt && img_alt.length > 10) {
        return img_alt;
    }
    
    return null;
}

async function open_image_viewer(image_src, title, image_hash) {
    if (!title) {
        title = 'Image';
    }
    
    image_viewer_title.textContent = title;
    image_viewer_image.src = image_src;
    image_viewer_image.alt = title;
    
    image_viewer_document_details.style.display = 'none';
    document_url_btn.style.display = 'none';
    
    image_viewer.classList.add('active');
    is_image_viewer_open = true;
    
    document.body.style.overflow = 'hidden';
    
    image_viewer_close.focus();
    
    if (image_hash) {
        try {
            const response = await fetch(`/api/image/${image_hash}/details`, {
                skipNotification: true
            });
            
            if (response.ok) {
                const data = await response.json();
                display_document_details(data.documents);
            } else {
                console.log('No document details found for image');
            }
        } catch (error) {
            console.error('Failed to fetch image details:', error);
        }
    }
}

function display_document_details(documents) {
    if (!documents || documents.length === 0) {
        image_viewer_document_details.style.display = 'none';
        return;
    }
    
    const doc = documents[0];
    
    document_title.textContent = doc.title || 'Untitled Document';
    document_content.textContent = doc.content || 'No content available';
    
    if (doc.url) {
        document_url_btn.style.display = 'inline-block';
        document_url_btn.onclick = () => {
            window.open(doc.url, '_blank');
        };
    } else {
        document_url_btn.style.display = 'none';
    }
    
    image_viewer_document_details.style.display = 'block';
}

function close_image_viewer() {
    image_viewer.classList.remove('active');
    is_image_viewer_open = false;
    
    document.body.style.overflow = '';
    
    image_viewer_image.src = '';
    
    image_viewer_document_details.style.display = 'none';
    document_title.textContent = '';
    document_content.textContent = '';
    document_url_btn.style.display = 'none';
    document_url_btn.onclick = null;
}
