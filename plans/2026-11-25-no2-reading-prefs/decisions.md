# Decisions

## Accepted (user, 2026-11-25 15:30 +07: "thêm chức năng chọn kích cỡ chữ, font chữ, default là font hiện tại đi … chỉ là thêm nhiều lựa chọn thôi, lên plan xong làm luôn đi nha, khỏi hỏi lại")

- D1 (accepted): The default is unchanged: Plus Jakarta Sans for text, Epilogue for headings, current sizes. A reader who never touches the control sees exactly today's blog.
- D2 (accepted): Font choices are self-hosted through `@fontsource` (the CSP has `font-src 'self'`, Google Fonts would be blocked) and all carry a `vietnamese` subset: **Mặc định** (Plus Jakarta Sans, already bundled), **Be Vietnam Pro** (sans designed for Vietnamese), **Lora** (serif, for long reading), **Hệ thống** (`system-ui`, zero download). `@font-face` declarations with `unicode-range` mean a font is downloaded only when selected.
- D3 (accepted): Text size has four steps for the post body: Nhỏ 16px, Vừa 18px (today's `prose-lg` size, default), Lớn 20px, Rất lớn 22px, applied through a CSS variable on the article so headings, lists and code scale with it. The font choice applies to the whole site (body font); the size applies to the post body and comments only, so cards and the dashboard keep their layout.
- D4 (accepted): Preferences live in `localStorage` (`reading-prefs`), like the theme (D45 of the monorepo plan). No account setting, no database.

## Rejected

- Google Fonts `<link>`: blocked by the CSP and adds a third-party request.
- A dyslexia-oriented font (OpenDyslexic, Atkinson Hyperlegible): no Vietnamese glyphs.
- Per-user server-side setting: a reading preference belongs to the device (phone vs. laptop), and the blog has no settings table.

## Open Questions

None.
