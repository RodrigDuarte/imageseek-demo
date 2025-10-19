const debug_panel = document.getElementById("debug_panel");
const debug_close_btn = document.getElementById("debug_close");

let is_debug_open = false;
const page_load_start = performance.now();
let calculated_load_time = null;
let global_progress_interval = null;
let background_progress_check = null;
document.addEventListener('DOMContentLoaded', function() {
  initialize_progress_bar();
});

function initialize_progress_bar() {
  const progress_container = document.getElementById("embedding_progress_container");
  if (progress_container) {
    progress_container.className = "embedding-progress-container idle";
  }
}

function start_background_progress_monitoring() {
  stop_background_progress_monitoring();
  
  console.log('[DEBUG] Starting background progress monitoring...');
  
  background_progress_check = setInterval(async () => {
    if (global_progress_interval) return;
    
    try {
      const response = await fetch("/api/embeddings/progress", {
        skipNotification: true
      });
      
      if (!response.ok) {
        stop_background_progress_monitoring();
        return;
      }
      
      const progress = await response.json();
      
      if (progress && !progress.error && progress.active) {
        console.log('[DEBUG] Background check: Embedding generation detected as active!');
        check_embedding_progress_on_open();
      }
    } catch (error) {
    }
  }, 5000);
}

let statistics_polling_interval = null;
let system_info_polling_interval = null;

function show_debug_panel() {
  if (is_debug_open) return;

  debug_panel.classList.add("opening");
  debug_panel.classList.add("active");
  is_debug_open = true;

  update_system_info();
  fetch_server_statistics();
  
  start_statistics_polling();
  start_system_info_polling();
  start_background_progress_monitoring();
  
  check_embedding_progress_on_open();

  setTimeout(() => {
    debug_panel.classList.remove("opening");
  }, 300);
}

function hide_debug_panel() {
  if (!is_debug_open) return;

  debug_panel.classList.add("closing");
  
  stop_progress_polling();
  stop_statistics_polling();
  stop_system_info_polling();
  stop_background_progress_monitoring();

  setTimeout(() => {
    debug_panel.classList.remove("active");
    debug_panel.classList.remove("closing");
    is_debug_open = false;
  }, 300);
}

function start_statistics_polling() {
  stop_statistics_polling();
  
  statistics_polling_interval = setInterval(() => {
    if (is_debug_open) {
      fetch_server_statistics();
    }
  }, 60000);
}

function stop_statistics_polling() {
  if (statistics_polling_interval) {
    clearInterval(statistics_polling_interval);
    statistics_polling_interval = null;
  }
}

function start_system_info_polling() {
  stop_system_info_polling();
  
  system_info_polling_interval = setInterval(() => {
    if (is_debug_open) {
      update_system_info();
    }
  }, 5000);
}

function stop_system_info_polling() {
  if (system_info_polling_interval) {
    clearInterval(system_info_polling_interval);
    system_info_polling_interval = null;
  }
}

function toggle_debug_panel() {
  if (is_debug_open) {
    hide_debug_panel();
  } else {
    show_debug_panel();
  }
}

function update_system_info() {
  document.getElementById("debug_user_agent").textContent =
    navigator.userAgent.substring(0, 80) +
    (navigator.userAgent.length > 80 ? "..." : "");

  document.getElementById(
    "debug_screen_resolution"
  ).textContent = `${screen.width} × ${screen.height}`;

  document.getElementById(
    "debug_viewport_size"
  ).textContent = `${window.innerWidth} × ${window.innerHeight}`;

  const current_theme = body.getAttribute("data-theme") || "light";
  document.getElementById("debug_current_theme").textContent = current_theme;

  const stored_theme = localStorage.getItem("theme") || "not set";
  document.getElementById("debug_stored_theme").textContent = stored_theme;

  const connection = navigator.onLine ? "Online" : "Offline";
  document.getElementById("debug_connection").textContent = connection;

  if (calculated_load_time === null) {
    calculated_load_time = (performance.now() - page_load_start).toFixed(2);
  }
  document.getElementById(
    "debug_load_time"
  ).textContent = `${calculated_load_time} ms`;
}

function set_default_values() {
  document.getElementById("debug_total_images").textContent = "0";
  document.getElementById("debug_visible_images").textContent = "0";
  document.getElementById("debug_hidden_images").textContent = "0";
  document.getElementById("debug_total_documents").textContent = "0";
  document.getElementById("debug_visible_documents").textContent = "0";
  document.getElementById("debug_hidden_documents").textContent = "0";
  document.getElementById("debug_watched_folders").textContent = "0";
  
  document.getElementById("debug_schedule_type").textContent = "N/A";
  document.getElementById("debug_start_hour").textContent = "N/A";
  document.getElementById("debug_interval_hours").textContent = "N/A";
  document.getElementById("debug_current_model").textContent = "N/A";
  document.getElementById("debug_scheduler_running").textContent = "No";
}

async function fetch_server_statistics() {
  try {
    const response = await fetch("/api/status", {
      skipNotification: true
    });
    
    if (!response.ok) {
      set_default_values();
      return;
    }
    
    const data = await response.json();

    if (data.statistics) {
      document.getElementById("debug_total_images").textContent =
        data.statistics.total_images || "N/A";
      document.getElementById("debug_visible_images").textContent =
        data.statistics.visible_images || "N/A";
      document.getElementById("debug_hidden_images").textContent =
        data.statistics.hidden_images || "N/A";
      document.getElementById("debug_total_documents").textContent =
        data.statistics.total_documents || "N/A";
      document.getElementById("debug_visible_documents").textContent =
        data.statistics.visible_documents || "N/A";
      document.getElementById("debug_hidden_documents").textContent =
        data.statistics.hidden_documents || "N/A";
      document.getElementById("debug_watched_folders").textContent =
        data.statistics.watched_folders || "N/A";
    } else {
      set_default_values();
    }

    if (data.embedding_schedule) {
      document.getElementById("debug_schedule_type").textContent =
        data.embedding_schedule.schedule_type || "N/A";
      document.getElementById("debug_start_hour").textContent =
        data.embedding_schedule.start_hour || "N/A";
      document.getElementById("debug_interval_hours").textContent =
        data.embedding_schedule.interval_hours || "N/A";
      document.getElementById("debug_current_model").textContent =
        data.embedding_schedule.current_model || "N/A";
      document.getElementById("debug_scheduler_running").textContent = data
        .embedding_schedule.scheduler_running
        ? "Yes"
        : "No";
    } else {
      set_default_values();
    }
  } catch (error) {
    console.error("Failed to fetch server statistics:", error);
    set_default_values();
  }
}

async function check_embedding_progress_on_open() {
  console.log('[DEBUG] Checking embedding progress on modal open...');
  try {
    const response = await fetch("/api/embeddings/progress", {
      skipNotification: true
    });
    
    if (!response.ok) {
      return;
    }
    
    const progress = await response.json();
    console.log('[DEBUG] Progress response:', progress);
    
    if (progress && !progress.error && progress.active) {
      console.log('[DEBUG] Embedding generation is active, setting up progress display...');
      const progress_container = document.getElementById("embedding_progress_container");
      const button = document.getElementById("generate_embeddings_btn");
      
      console.log('[DEBUG] Found elements:', {
        progress_container: !!progress_container,
        button: !!button
      });
      
      button.disabled = true;
      button.textContent = "Generating...";
      progress_container.className = "embedding-progress-container active";
      
      console.log('[DEBUG] Updated UI state, starting progress polling...');
      
      update_progress_display(progress);
      
      start_progress_polling();
    } else {
      console.log('[DEBUG] No active embedding generation found');
    }
  } catch (error) {
    console.error("[DEBUG] Failed to check embedding progress:", error);
  }
}

function set_embedding_error() {
  document.getElementById("debug_schedule_type").textContent = "Error";
  document.getElementById("debug_start_hour").textContent = "Error";
  document.getElementById("debug_interval_hours").textContent = "Error";
  document.getElementById("debug_current_model").textContent = "Error";
  document.getElementById("debug_scheduler_running").textContent = "Error";
}

async function trigger_embedding_generation() {
  const button = document.getElementById("generate_embeddings_btn");
  const progress_container = document.getElementById("embedding_progress_container");

  button.disabled = true;
  button.textContent = "Generating...";
  
  progress_container.className = "embedding-progress-container active";
  
  start_progress_polling();

  try {
    const response = await fetch("/api/embeddings/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      skipNotification: true
    });

    if (!response.ok) {
      stop_progress_polling();
      showError("Generation Failed", "Unable to start embedding generation");
      return;
    }

    const result = await response.json();

    stop_progress_polling();

    if (result.success) {
      const message = `Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors}`;
      showSuccess("Embedding Generation Complete", message);
      
      update_progress_display({
        active: false,
        stage: "Completed",
        percentage: 100,
        processed: result.processed,
        skipped: result.skipped,
        errors: result.errors
      });
    } else {
      showError("Embedding Generation Failed", result.error);
      
      progress_container.className = "embedding-progress-container idle";
    }
  } catch (error) {
    console.error("Failed to generate embeddings:", error);
    showError("Embedding Generation Error", `Failed to generate embeddings: ${error.message}`);
    
    stop_progress_polling();
    progress_container.className = "embedding-progress-container idle";
  } finally {
    button.disabled = false;
    button.textContent = "Generate Embeddings";

    setTimeout(() => {
      if (progress_container.className !== "embedding-progress-container completed") {
        progress_container.className = "embedding-progress-container idle";
        const progress_text = document.getElementById("embedding_progress_text");
        const progress_percentage = document.getElementById("embedding_progress_percentage");
        const progress_fill = document.getElementById("embedding_progress_fill");
        const progress_details = document.getElementById("embedding_progress_details");
        
        progress_text.textContent = "Ready";
        progress_percentage.textContent = "0%";
        progress_fill.style.width = "0%";
        progress_details.textContent = "Ready to generate embeddings";
      }
    }, 3000);
  }
}

debug_close_btn.addEventListener("click", () => hide_debug_panel());

document
  .getElementById("generate_embeddings_btn")
  .addEventListener("click", () => {
    trigger_embedding_generation();
  });

debug_panel.addEventListener("click", (e) => {
  if (e.target === debug_panel) {
    hide_debug_panel();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "m" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    if (
      document.activeElement.tagName.toLowerCase() !== "input" &&
      document.activeElement.tagName.toLowerCase() !== "textarea"
    ) {
      e.preventDefault();
      toggle_debug_panel();
    }
  }

  if (e.key === "Escape" && is_debug_open) {
    hide_debug_panel();
  }
});

update_system_info();

// System info and statistics will only be polled when debug panel is open

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.search.includes('test-notifications')) {
        setTimeout(() => {
            showInfo('System', 'Debug mode enabled - notification system loaded');
            setTimeout(() => showWarning('Test Warning', 'This is a test warning message'), 1000);
            setTimeout(() => showError('Test Error', 'This is a test error message'), 2000);
            setTimeout(() => showSuccess('Test Success', 'This is a test success message'), 3000);
        }, 500);
    }
});

function start_progress_polling() {
  stop_progress_polling();
  
  console.log('[DEBUG] Starting active progress polling...');
  
  global_progress_interval = setInterval(async () => {
    try {
      const response = await fetch("/api/embeddings/progress", {
        skipNotification: true
      });
      
      if (!response.ok) {
        stop_progress_polling();
        return;
      }
      
      const progress = await response.json();
      
      if (progress && !progress.error) {
        update_progress_display(progress);
        
        if (!progress.active) {
          console.log('[DEBUG] Embedding generation completed, stopping active polling');
          stop_progress_polling();
          
          const button = document.getElementById("generate_embeddings_btn");
          const progress_container = document.getElementById("embedding_progress_container");
          button.disabled = false;
          button.textContent = "Generate Embeddings";
          
          progress_container.className = "embedding-progress-container completed";
          setTimeout(() => {
            progress_container.className = "embedding-progress-container idle";
            const progress_text = document.getElementById("embedding_progress_text");
            const progress_percentage = document.getElementById("embedding_progress_percentage");
            const progress_fill = document.getElementById("embedding_progress_fill");
            const progress_details = document.getElementById("embedding_progress_details");
            
            progress_text.textContent = "Ready";
            progress_percentage.textContent = "0%";
            progress_fill.style.width = "0%";
            progress_details.textContent = "Ready to generate embeddings";
          }, 5000);
        }
      }
    } catch (error) {
      console.error("Failed to fetch progress:", error);
    }
  }, 1000);
}

function stop_progress_polling() {
  if (global_progress_interval) {
    clearInterval(global_progress_interval);
    global_progress_interval = null;
    console.log('[DEBUG] Stopped active progress polling');
  }
}

function stop_background_progress_monitoring() {
  if (background_progress_check) {
    clearInterval(background_progress_check);
    background_progress_check = null;
    console.log('[DEBUG] Stopped background progress monitoring');
  }
}

function update_progress_display(progress) {
  console.log('[DEBUG] Updating progress display with:', progress);
  
  const progress_text = document.getElementById("embedding_progress_text");
  const progress_percentage = document.getElementById("embedding_progress_percentage");
  const progress_fill = document.getElementById("embedding_progress_fill");
  const progress_details = document.getElementById("embedding_progress_details");

  console.log('[DEBUG] Found progress elements:', {
    progress_text: !!progress_text,
    progress_percentage: !!progress_percentage,
    progress_fill: !!progress_fill,
    progress_details: !!progress_details
  });

  if (!progress_text || !progress_percentage || !progress_fill || !progress_details) {
    console.error('[DEBUG] Missing progress elements!');
    return;
  }

  progress_text.textContent = progress.stage || "Processing...";
  
  const percentage = Math.round(progress.percentage || 0);
  progress_percentage.textContent = `${percentage}%`;
  progress_fill.style.width = `${percentage}%`;
  
  console.log('[DEBUG] Updated progress:', {
    stage: progress.stage,
    percentage: percentage,
    width: progress_fill.style.width
  });
  
  let details = "";
  if (progress.total > 0) {
    details += `Progress: ${progress.current || 0}/${progress.total} items`;
  }
  if (progress.processed !== undefined || progress.skipped !== undefined || progress.errors !== undefined) {
    const processed = progress.processed || 0;
    const skipped = progress.skipped || 0;
    const errors = progress.errors || 0;
    details += `\nProcessed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`;
  }
  if (progress.elapsed_time) {
    const elapsed = Math.round(progress.elapsed_time);
    details += `\nElapsed: ${elapsed}s`;
  }
  
  progress_details.textContent = details;
  console.log('[DEBUG] Updated details:', details);
}
