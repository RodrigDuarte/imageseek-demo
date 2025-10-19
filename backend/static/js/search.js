const search_input = document.getElementById('search_input');
const search_button = document.getElementById('search_button');
const search_form = document.getElementById('search_form');
const max_results_select = document.getElementById('max_results_select');
const loading_indicator = document.getElementById('loading');
const no_results = document.getElementById('no_results');
const results_list = document.getElementById('results_list');
const results_container = document.getElementById('results_container');
const welcome_section = document.getElementById('welcome_section');

let is_hybrid_search = false;
let search_toggle_button = null;
let hybrid_function_select = null;
let current_model_info = null;

document.addEventListener('DOMContentLoaded', function() {
    initialize_search();
});

function initialize_search() {
    create_search_toggle();
    create_hybrid_function_selector();
    create_google_comparison_button();
    setup_event_listeners();
    setup_example_queries();
    hide_all_result_elements();
    show_welcome_section();
    fetch_model_info();
}

function create_search_toggle() {
    const toggle_container = document.createElement('div');
    toggle_container.className = 'search-toggle-container';
    
    search_toggle_button = document.createElement('button');
    search_toggle_button.className = 'search-toggle';
    search_toggle_button.id = 'search_toggle';
    search_toggle_button.title = 'Loading model information...';
    
    const toggle_text = document.createElement('span');
    toggle_text.id = 'search_toggle_text';
    toggle_text.textContent = 'Normal';
    
    const info_indicator = document.createElement('span');
    info_indicator.className = 'model-info-indicator';
    info_indicator.innerHTML = ' ℹ️';
    info_indicator.style.fontSize = '12px';
    info_indicator.style.opacity = '0.7';
    
    search_toggle_button.appendChild(toggle_text);
    search_toggle_button.appendChild(info_indicator);
    toggle_container.appendChild(search_toggle_button);
    
    const search_toggle_container = document.getElementById('search_toggle_container');
    search_toggle_container.appendChild(toggle_container);
    
    search_toggle_button.addEventListener('click', toggle_search_mode);
}

function create_hybrid_function_selector() {
    const control_group = document.createElement('div');
    control_group.className = 'control-group';
    control_group.id = 'hybrid_function_group';
    control_group.style.display = 'none';
    
    const label = document.createElement('label');
    label.htmlFor = 'hybrid_function_select';
    label.className = 'control-label';
    label.textContent = 'Function:';
    
    hybrid_function_select = document.createElement('select');
    hybrid_function_select.id = 'hybrid_function_select';
    hybrid_function_select.className = 'control-select';
    
    const functions = [
        { value: 1, text: 'Linear Decay (Zero-indexed)' },
        { value: 2, text: 'Linear Decay (One-indexed)' },
        { value: 3, text: 'Square Root Decay' },
        { value: 4, text: 'Exponential Decay' }
    ];
    
    functions.forEach(func => {
        const option = document.createElement('option');
        option.value = func.value;
        option.textContent = func.text;
        if (func.value === 1) option.selected = true;
        hybrid_function_select.appendChild(option);
    });
    
    control_group.appendChild(label);
    control_group.appendChild(hybrid_function_select);
    
    const max_results_control = document.querySelector('#max_results_select').parentElement;
    max_results_control.parentElement.appendChild(control_group);
}

function create_google_comparison_button() {
    const google_button = document.createElement('button');
    google_button.type = 'button';
    google_button.className = 'google-comparison-button';
    google_button.id = 'google_comparison_button';
    google_button.title = 'Compare results with Google Images (presidencia.pt only)\nOpens in new tab for side-by-side comparison';
    google_button.innerHTML = 'Search on Google Images';
    
    google_button.addEventListener('click', open_google_comparison);
    
    // Add to the search buttons container
    const search_buttons_container = document.getElementById('search_buttons_container');
    search_buttons_container.appendChild(google_button);
}

function setup_event_listeners() {
    search_button.addEventListener('click', perform_search);
    
    search_input.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            perform_search();
        }
    });
    
    search_input.addEventListener('input', function() {
        if (search_input.value.trim() === '') {
            clear_results();
        }
    });
    
    max_results_select.addEventListener('change', function() {
        clear_results();
    });
}

function setup_example_queries() {
    const query_suggestions = document.querySelectorAll('.query-suggestion');
    
    query_suggestions.forEach(button => {
        button.addEventListener('click', function() {
            const query = this.getAttribute('data-query');
            search_input.value = query;
            perform_search();
        });
    });
}

function show_welcome_section() {
    if (welcome_section) {
        welcome_section.style.display = 'block';
    }
}

function hide_welcome_section() {
    if (welcome_section) {
        welcome_section.style.display = 'none';
    }
}

function toggle_search_mode() {
    is_hybrid_search = !is_hybrid_search;
    
    const toggle_text = document.getElementById('search_toggle_text');
    const search_input_placeholder = search_input;
    const hybrid_function_group = document.getElementById('hybrid_function_group');
    
    if (is_hybrid_search) {
        toggle_text.textContent = 'Hybrid';
        search_toggle_button.classList.add('hybrid-mode');
        search_input_placeholder.placeholder = 'Enter hybrid search query...';
        hybrid_function_group.style.display = 'flex';
    } else {
        toggle_text.textContent = 'Normal';
        search_toggle_button.classList.remove('hybrid-mode');
        search_input_placeholder.placeholder = 'Search for images...';
        hybrid_function_group.style.display = 'none';
    }
    
    update_search_toggle_tooltip();
    
    clear_results();
}

async function perform_search() {
    const query = search_input.value.trim();
    const max_results = parseInt(max_results_select.value);
    const hybrid_function = is_hybrid_search ? parseInt(hybrid_function_select.value) : 1;
    
    if (!query) {
        show_error_message('Please enter a search query');
        return;
    }
    
    hide_welcome_section();
    
    try {
        show_loading();
        
        const endpoint = is_hybrid_search ? '/search_complex' : '/search';
        const body_data = { 
            query: query,
            max_results: max_results
        };
        
        if (is_hybrid_search) {
            body_data.hybrid_function = hybrid_function;
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body_data),
            skipNotification: true
        });
        
        const data = await response.json();
        
        if (response.status === 202 && data.status === 'model_loading') {
            show_model_loading_message(data.message);
            
            if (data.message.includes('now loading')) {
                showInfo(
                    'First Search Setup', 
                    'Initializing AI model for the first time. Subsequent searches will be much faster!',
                    { duration: 8000 }
                );
            }
            
            await poll_for_model_ready_and_search(body_data, endpoint);
            return;
        }
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        
        display_results(data);
        
    } catch (error) {
        console.error('Search failed:', error);
        show_error_message(`Search failed: ${error.message}`);
    } finally {
        hide_loading();
    }
}

async function poll_for_model_ready_and_search(search_data, endpoint) {
    const max_attempts = 60;
    const poll_interval = 1000;
    let attempts = 0;
    
    const poll_timer = setInterval(async () => {
        attempts++;
        
        try {
            const status_response = await fetch('/api/search/status');
            const status_data = await status_response.json();
            
            if (status_data.ready_for_search) {
                clearInterval(poll_timer);
                
                const notification_id = search_input.dataset.loadingNotificationId;
                if (notification_id) {
                    update_notification_message(
                        notification_id, 
                        'Model Ready', 
                        'Model loaded successfully! Processing your search...'
                    );
                    
                    setTimeout(() => {
                        remove_notification(parseInt(notification_id));
                        delete search_input.dataset.loadingNotificationId;
                    }, 2000);
                }
                
                show_loading();
                
                const search_response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(search_data),
                    skipNotification: true
                });
                
                const search_result = await search_response.json();
                
                if (search_response.ok) {
                    display_results(search_result);
                    
                    showSuccess('Search Complete', `Found ${search_result.total} results for "${search_data.query}"`);
                } else {
                    throw new Error(search_result.error || `HTTP error! status: ${search_response.status}`);
                }
                
                hide_loading();
                return;
            }
            
            let progress_message = `Loading model... (${attempts}s)`;
            if (status_data.model_status === 'loading') {
                progress_message = `AI model is loading, please wait... (${attempts}s elapsed)`;
            }
            
            update_model_loading_message(progress_message);
            
            if (attempts >= max_attempts) {
                clearInterval(poll_timer);
                
                const notification_id = search_input.dataset.loadingNotificationId;
                if (notification_id) {
                    update_notification_message(
                        notification_id, 
                        'Loading Timeout', 
                        'Model loading is taking longer than expected. Please try again.'
                    );
                    
                    setTimeout(() => {
                        remove_notification(parseInt(notification_id));
                        delete search_input.dataset.loadingNotificationId;
                        showError('Model Loading Timeout', 'Model loading timeout - please try again later');
                    }, 3000);
                }
                
                throw new Error('Model loading timeout - please try again later');
            }
            
        } catch (error) {
            clearInterval(poll_timer);
            console.error('Polling error:', error);
            
            const notification_id = search_input.dataset.loadingNotificationId;
            if (notification_id) {
                remove_notification(parseInt(notification_id));
                delete search_input.dataset.loadingNotificationId;
            }
            
            show_error_message(`Search failed: ${error.message}`);
            hide_loading();
        }
    }, poll_interval);
}

function display_results(data) {
    console.log('Received data:', data);
    console.log('Results structure:', data.results);
    
    if (data.warning) {
        show_warning_message(data.warning);
    }
    
    if (!data.results || data.total === 0) {
        show_no_results();
        return;
    }
    
    if (is_hybrid_search) {
        display_normal_results(data);
    } else {
        display_normal_results(data);
    }
}

function display_normal_results(data) {
    results_list.innerHTML = '';
    
    data.results.forEach((result, index) => {
        console.log(`Result ${index}:`, result);
        const result_item = create_normal_result_item(result, index);
        results_list.appendChild(result_item);
    });
    
    show_results();
}

function display_complex_results(data) {
    results_list.innerHTML = '';
    
    if (data.search_type === 'image_fallback') {
        data.results.forEach((result, index) => {
            console.log(`Fallback result ${index}:`, result);
            const result_item = create_normal_result_item(result, index);
            results_list.appendChild(result_item);
        });
    } else {
        if (data.results.hash) {
            Object.entries(data.results.hash).forEach(([hash, info], index) => {
                const result_item = create_hybrid_result_item(hash, info, index);
                results_list.appendChild(result_item);
            });
        }
    }
    
    show_results();
}

function create_normal_result_item(result, index) {
    const result_item = document.createElement('div');
    result_item.className = 'result-item';
    result_item.setAttribute('data-index', index);
    
    const result_image = document.createElement('div');
    result_image.className = 'result-image';
    
    const img = document.createElement('img');
    img.src = result.url || `/image/${result.hash || result.id}`;
    img.alt = result.hash || 'Search result';
    img.className = 'result-img';
    img.loading = 'lazy';
    
    img.onerror = function() {
        console.warn('Failed to load image:', result.url);
        this.style.display = 'none';
    };
    
    result_image.appendChild(img);
    
    const result_info = document.createElement('div');
    result_info.className = 'result-info';
    
    const result_title = document.createElement('div');
    result_title.className = 'result-title';
    result_title.textContent = result.hash || 'Unknown';
    
    const result_score = document.createElement('div');
    result_score.className = 'result-score';
    const score_value = parseFloat(result.score) || 0;
    result_score.textContent = `Score: ${score_value.toFixed(3)}`;
    
    const result_id = document.createElement('div');
    result_id.className = 'result-id';
    result_id.textContent = `ID: ${result.id || result.hash || 'Unknown'}`;
    
    result_info.appendChild(result_title);
    result_info.appendChild(result_score);
    result_info.appendChild(result_id);
    
    result_item.appendChild(result_image);
    result_item.appendChild(result_info);
    
    return result_item;
}

function create_hybrid_result_item(hash, info, index) {
    const result_item = document.createElement('div');
    result_item.className = 'result-item hybrid-result';
    result_item.setAttribute('data-index', index);
    result_item.setAttribute('data-hash', hash);
    
    const result_image = document.createElement('div');
    result_image.className = 'result-image';
    
    const img = document.createElement('img');
    img.src = info.url || `/image/${hash}`;
    img.alt = `Hybrid search result ${hash}`;
    img.className = 'result-img';
    img.loading = 'lazy';
    
    result_image.appendChild(img);
    
    const result_info = document.createElement('div');
    result_info.className = 'result-info';
    
    const result_hash = document.createElement('div');
    result_hash.className = 'result-title';
    result_hash.textContent = `Hash: ${hash.substring(0, 12)}...`;
    
    const result_details = document.createElement('div');
    result_details.className = 'result-details';
    result_details.textContent = typeof info === 'object' ? 
        JSON.stringify(info) : 
        String(info);
    
    result_info.appendChild(result_hash);
    result_info.appendChild(result_details);
    
    result_item.appendChild(result_image);
    result_item.appendChild(result_info);
    
    return result_item;
}

function show_loading() {
    hide_all_result_elements();
    loading_indicator.style.display = 'flex';
    search_button.disabled = true;
    search_button.textContent = 'Searching...';
    search_button.classList.add('loading');
}

function hide_loading() {
    loading_indicator.style.display = 'none';
    search_button.disabled = false;
    search_button.textContent = 'Search';
    search_button.classList.remove('loading');
    hide_model_loading();
}

function show_model_loading_message(message) {
    hide_all_result_elements();
    
    const loading_notification_id = showInfo(
        'Model Loading', 
        'The AI model is loading. Please wait while we prepare your search...', 
        { persistent: true, duration: 0 }
    );
    
    search_input.dataset.loadingNotificationId = loading_notification_id;
    
    let model_loading_indicator = document.getElementById('model_loading_indicator');
    if (!model_loading_indicator) {
        model_loading_indicator = document.createElement('div');
        model_loading_indicator.id = 'model_loading_indicator';
        model_loading_indicator.className = 'model-loading-container';
        
        const loading_icon = document.createElement('div');
        loading_icon.className = 'loading-spinner';
        
        const loading_text = document.createElement('div');
        loading_text.className = 'loading-text';
        loading_text.id = 'model_loading_text';
        
        const loading_subtext = document.createElement('div');
        loading_subtext.className = 'loading-subtext';
        loading_subtext.textContent = 'This may take a few moments...';
        
        model_loading_indicator.appendChild(loading_icon);
        model_loading_indicator.appendChild(loading_text);
        model_loading_indicator.appendChild(loading_subtext);
        
        loading_indicator.parentNode.insertBefore(model_loading_indicator, loading_indicator.nextSibling);
    }
    
    document.getElementById('model_loading_text').textContent = message;
    model_loading_indicator.style.display = 'flex';
    
    search_button.disabled = true;
    search_button.textContent = 'Loading Model...';
    search_button.classList.add('loading');
}

function update_model_loading_message(message) {
    const loading_text = document.getElementById('model_loading_text');
    if (loading_text) {
        loading_text.textContent = message;
    }
    
    const notification_id = search_input.dataset.loadingNotificationId;
    if (notification_id) {
        update_notification_message(notification_id, 'Model Loading', message);
    }
}

function hide_model_loading() {
    const model_loading_indicator = document.getElementById('model_loading_indicator');
    if (model_loading_indicator) {
        model_loading_indicator.style.display = 'none';
    }
    
    search_button.classList.remove('loading');
    
    const notification_id = search_input.dataset.loadingNotificationId;
    if (notification_id) {
        remove_notification(parseInt(notification_id));
        delete search_input.dataset.loadingNotificationId;
    }
}

function show_results() {
    hide_all_result_elements();
    results_list.style.display = 'flex';
}

function show_no_results() {
    hide_all_result_elements();
    no_results.style.display = 'block';
}

function show_error_message(message) {
    hide_all_result_elements();
    showError('Search Error', message);
}

function show_warning_message(warning) {
    let message = warning.message;
    if (warning.reason) {
        message += ` (${warning.reason})`;
    }
    
    showWarning('Search Warning', message);
}

function clear_results() {
    hide_all_result_elements();
    results_list.innerHTML = '';
    search_input.value = '';
    show_welcome_section();
}

function hide_all_result_elements() {
    loading_indicator.style.display = 'none';
    no_results.style.display = 'none';
    results_list.style.display = 'none';
    
    const model_loading_indicator = document.getElementById('model_loading_indicator');
    if (model_loading_indicator) {
        model_loading_indicator.style.display = 'none';
    }
}

function get_search_mode() {
    return is_hybrid_search ? 'hybrid' : 'normal';
}

function open_google_comparison() {
    const query = search_input.value.trim();
    
    if (!query) {
        show_error_message('Please enter a search query first');
        return;
    }
    
    // Date range configuration
    // Needs to be in MM/DD/YY format for Google
    const start_date = '01/01/16';
    const end_date = '03/31/25';
    
    const encoded_start = encodeURIComponent(start_date);
    const encoded_end = encodeURIComponent(end_date);
    
    const encoded_query = encodeURIComponent(query);
    
    // Construct Google Images search URL with site restriction to presidencia.pt
    // Using &udm=2 parameter for Google Images search
    // Using &tbs=cdr%3A1%2Ccd_min%3A...%2Ccd_max%3A... for date range
    const google_url = `https://www.google.com/search?q=${encoded_query}+site%3Apresidencia.pt&udm=2&hl=en&tbs=cdr%3A1%2Ccd_min%3A${encoded_start}%2Ccd_max%3A${encoded_end}`;
    
    window.open(google_url, '_blank', 'noopener,noreferrer');
}

async function fetch_model_info() {
    try {
        const response = await fetch('/api/model/status', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn('Failed to fetch model info:', response.status);
            return;
        }

        const data = await response.json();
        current_model_info = data;
        update_search_toggle_tooltip();
    } catch (error) {
        console.warn('Error fetching model info:', error);
    }
}

function update_search_toggle_tooltip() {
    if (!search_toggle_button || !current_model_info) {
        return;
    }

    const info = current_model_info.info;
    if (!info) {
        search_toggle_button.title = 'Toggle search mode';
        return;
    }

    const model_name = info.alias || 'Unknown Model';
    const model_description = info.description || 'No description available';
    const model_type = info.model_type || 'Unknown Type';
    const search_mode = is_hybrid_search ? 'Hybrid' : 'Normal';
    
    // Create a detailed tooltip
    const tooltip = `Current Search Mode: ${search_mode}
Model: ${model_name}
Type: ${model_type}
Description: ${model_description}

Click to toggle between Normal and Hybrid search modes`;
    
    search_toggle_button.title = tooltip;
}

// Periodically refresh model info in case it changes
setInterval(fetch_model_info, 30000); // Refresh every 30 seconds

window.SearchModule = {
    perform_search,
    toggle_search_mode,
    get_search_mode,
    clear_results,
    open_google_comparison
};