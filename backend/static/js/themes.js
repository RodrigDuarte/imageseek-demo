const theme_toggle = document.getElementById('theme_toggle');
const theme_icon = document.getElementById('theme_icon');
const body = document.body;

function get_prefered_theme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function update_theme_icon(theme) {
    theme_icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

const saved_theme = localStorage.getItem('theme') || get_prefered_theme();
body.setAttribute('data-theme', saved_theme);
update_theme_icon(saved_theme);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
        const new_theme = e.matches ? 'dark' : 'light';
        body.setAttribute('data-theme', new_theme);
        update_theme_icon(new_theme);
    }
});

theme_toggle.addEventListener('click', () => {
    const current_theme = body.getAttribute('data-theme');
    const new_theme = current_theme === 'dark' ? 'light' : 'dark';
    
    body.setAttribute('data-theme', new_theme);
    localStorage.setItem('theme', new_theme);
    update_theme_icon(new_theme);
});