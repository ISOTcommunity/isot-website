import os, glob, re

SITE_DIR = "/Users/amirhosseinshokouhipour/Desktop/claude projects/Digital Products/ISOT/website"
files = [
    "who-we-are.html", "what-we-do.html", "events.html", "partners.html",
    "donate.html", "contact.html", "join.html", "social.html", "privacy.html"
]

toggle_func = """
    function toggleMobileMenu() {
      const menu = document.getElementById('mobileMenu');
      const icon = document.getElementById('mobileToggleIcon');
      if (!menu) return;
      menu.classList.toggle('active');
      if (menu.classList.contains('active')) {
        icon.className = 'fa-solid fa-xmark';
        icon.style.color = 'var(--pink)';
      } else {
        icon.className = 'fa-solid fa-bars';
        icon.style.color = '#FFFFFF';
      }
    }
"""

mobile_menu_html = """      <button class="mobile-toggle" id="mobileToggle" aria-label="Toggle navigation" onclick="toggleMobileMenu()">
        <i class="fa-solid fa-bars" id="mobileToggleIcon"></i>
      </button>
    </div>

    <!-- Mobile Dropdown Menu -->
    <div class="mobile-menu" id="mobileMenu">
      <a href="who-we-are.html"><i class="fa-solid fa-users" style="color:var(--pink); margin-right:8px;"></i> Who We Are</a>
      <a href="what-we-do.html"><i class="fa-solid fa-rocket" style="color:var(--pink); margin-right:8px;"></i> What We Do</a>
      <a href="events.html"><i class="fa-solid fa-calendar-days" style="color:var(--pink); margin-right:8px;"></i> Events</a>
      <a href="blog.html"><i class="fa-solid fa-book-open" style="color:var(--pink); margin-right:8px;"></i> Turin Guide &amp; Blog</a>
      <a href="partners.html"><i class="fa-solid fa-handshake" style="color:var(--pink); margin-right:8px;"></i> Partners</a>
      <a href="donate.html"><i class="fa-solid fa-heart" style="color:var(--pink); margin-right:8px;"></i> Donate</a>
      <a href="contact.html"><i class="fa-solid fa-headset" style="color:var(--pink); margin-right:8px;"></i> Contact &amp; FAQ</a>
      <a href="/app/login.html"><i class="fa-solid fa-user" style="color:var(--pink); margin-right:8px;"></i> My Profile / Pass</a>
      <a href="join.html" class="btn btn-pink" style="margin-top:8px; justify-content:center;">Join Free →</a>
    </div>"""

for f in files:
    filepath = os.path.join(SITE_DIR, f)
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as fh:
        content = fh.read()

    # Replace mobile toggle button & menu if found
    if '<button class="mobile-toggle"' in content:
        # replace from <button class="mobile-toggle" to </div> after mobile-menu
        content = re.sub(
            r'<button class="mobile-toggle".*?<div class="mobile-menu" id="mobileMenu">.*?</div>',
            mobile_menu_html,
            content,
            flags=re.DOTALL
        )

    # Insert toggleMobileMenu js function before </body> if not present
    if 'function toggleMobileMenu' not in content:
        content = content.replace('</script>\n</body>', toggle_func + '\n  </script>\n</body>')
        content = content.replace('</script>\n  </body>', toggle_func + '\n  </script>\n  </body>')

    with open(filepath, 'w', encoding='utf-8') as fh:
        fh.write(content)

    print(f"Updated nav in {f}")
