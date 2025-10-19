let notification_container = null;
let notification_list = new Map();
let notification_id = 1;
const max_notifications = 5;
const default_duration = 5000;

function init_notifications() {
    notification_container = document.createElement('div');
    notification_container.className = 'notification-container';
    notification_container.id = 'notification-container';
    document.body.appendChild(notification_container);
}

function show_notification(type, title, message, options = {}) {
    if (!notification_container) {
        init_notifications();
    }

    const id = notification_id++;
    const duration = options.duration !== undefined ? options.duration : default_duration;
    const persistent = options.persistent || false;

    if (notification_list.size >= max_notifications) {
        const oldest_id = Array.from(notification_list.keys())[0];
        remove_notification(oldest_id);
    }

    const notification = create_notification_element(id, type, title, message);
    notification_container.appendChild(notification);

    notification_list.set(id, {
        element: notification,
        type: type,
        title: title,
        message: message,
        timestamp: Date.now()
    });

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    if (!persistent && duration > 0) {
        setTimeout(() => {
            remove_notification(id);
        }, duration);
    }

    log_to_console(type, title, message);

    return id;
}

function create_notification_element(id, type, title, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.dataset.id = id;

    const icon = get_notification_icon(type);
    
    notification.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
            <div class="notification-title">${escape_html(title)}</div>
            <div class="notification-message">${escape_html(message)}</div>
        </div>
        <button class="notification-close" title="Close">×</button>
    `;

    const close_btn = notification.querySelector('.notification-close');
    close_btn.addEventListener('click', () => {
        remove_notification(id);
    });

    return notification;
}

function get_notification_icon(type) {
    const icons = {
        error: '⚠',
        warning: '⚠',
        success: '✓',
        info: 'ℹ'
    };
    return icons[type] || 'ℹ';
}

function remove_notification(id) {
    const notification = notification_list.get(id);
    if (!notification) return;

    notification.element.classList.remove('show');

    setTimeout(() => {
        if (notification.element.parentNode) {
            notification.element.parentNode.removeChild(notification.element);
        }
        notification_list.delete(id);
    }, 300);
}

function update_notification_message(id, new_title, new_message) {
    const notification = notification_list.get(id);
    if (!notification) return;

    const title_element = notification.element.querySelector('.notification-title');
    const message_element = notification.element.querySelector('.notification-message');
    
    if (title_element && new_title) {
        title_element.textContent = new_title;
        notification.title = new_title;
    }
    
    if (message_element && new_message) {
        message_element.textContent = new_message;
        notification.message = new_message;
    }
}

function clear_all_notifications() {
    Array.from(notification_list.keys()).forEach(id => {
        remove_notification(id);
    });
}

function escape_html(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function log_to_console(type, title, message) {
    const log_message = `${title}: ${message}`;
    switch (type) {
        case 'error':
            console.error(log_message);
            break;
        case 'warning':
            console.warn(log_message);
            break;
        case 'info':
            console.info(log_message);
            break;
        case 'success':
            console.log(log_message);
            break;
        default:
            console.log(log_message);
    }
}

function showError(title, message, options = {}) {
    return show_notification('error', title, message, options);
}

function showWarning(title, message, options = {}) {
    return show_notification('warning', title, message, options);
}

function showSuccess(title, message, options = {}) {
    return show_notification('success', title, message, options);
}

function showInfo(title, message, options = {}) {
    return show_notification('info', title, message, options);
}

window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showError('Application Error', `An unexpected error occurred: ${event.error.message}`);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showError('Network Error', `Request failed: ${event.reason.message || event.reason}`);
});

const original_fetch = window.fetch;
window.fetch = async function(url, options = {}) {
    try {
        const response = await original_fetch(url, options);
        
        if (!response.ok && !options.skipNotification) {
            const error_text = await response.text();
            let error_message;
            
            try {
                const error_data = JSON.parse(error_text);
                error_message = error_data.error || error_data.message || `HTTP ${response.status}: ${response.statusText}`;
            } catch {
                error_message = `HTTP ${response.status}: ${response.statusText}`;
            }
            
            showError('Network Error', error_message);
        }
        
        return response;
    } catch (error) {
        if (!options.skipNotification) {
            showError('Connection Error', `Failed to connect to server: ${error.message}`);
        }
        throw error;
    }
};

// Export for use in other scripts
window.showError = showError;
window.showWarning = showWarning;
window.showSuccess = showSuccess;
window.showInfo = showInfo;
window.clear_all_notifications = clear_all_notifications;
window.remove_notification = remove_notification;
window.update_notification_message = update_notification_message;