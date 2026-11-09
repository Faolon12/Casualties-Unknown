# Casualties-Unknown

Repo for tools and mods for Casualties: Unknown, mainly mods I've made or am working on. It is also the **LUNA community hub**: a website with every mod, the rig editor, and rigs, add-ons, gear textures, sprites and props that players share.

**Website:** https://faolon12.github.io/Casualties-Unknown/

## Turn the website on (once)
0. **Rename the folder `_github` to `.github`** (the upload form and the bot live there; it had to be copied in under another name). In Windows Explorer: right-click → Rename → type `.github.` with a dot at the end too (Windows then keeps it as `.github`).
1. On GitHub: **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, branch **main**, folder **/ (root)** → Save. After a minute the site is live at the link above.
2. **Settings → Actions → General → Workflow permissions**: pick **Read and write permissions** → Save. (This lets the bot add approved uploads.)
3. **Issues → Labels**: make three labels: `approved`, `needs-changes`, `published` (and `submission` if GitHub didn't make it).
4. The editor link points to https://faolon12.github.io/Advanced-Rigs-Casualties-Unknown/. Turn Pages on in that repo too (same as step 1) so it works.

## Add or update a mod (the "easy button")
Open `data/mods.json` and paste your Nexus link into `"nexus"`:
```json
"nexus": "https://www.nexusmods.com/scavprototype/mods/123",
```
An empty `"nexus"` shows "Nexus · soon". To add a new mod, copy one entry and change it. Bump `"version"` when you release.

### Buttons for your Nexus pages
Put this in a Nexus mod description to link back to the hub and the editor:
```
[url=https://faolon12.github.io/Casualties-Unknown/][img]https://faolon12.github.io/Casualties-Unknown/assets/button-hub.png[/img][/url]
[url=https://faolon12.github.io/Advanced-Rigs-Casualties-Unknown/][img]https://faolon12.github.io/Casualties-Unknown/assets/button-editor.png[/img][/url]
```

## How sharing works
- Players press **Share yours** on the site. It opens a GitHub form where they drag in a zip and a picture.
- You look at it. If it's fine, add the **`approved`** label. A bot then:
  - downloads the files (only from GitHub's own upload storage),
  - checks the picture really is a picture, and that the zip only holds `.png .json .wav .ogg .mp3 .txt .md` (no programs, no unsafe paths, 25 MB max),
  - adds it to `resources/<name>-<issue number>/`, rebuilds the list, and comments the link on the post.
- If something's wrong, the bot comments the reason and labels it `needs-changes`. Once they fix the post, add `approved` again.
- The issue stays open as the comment thread for that upload. To take something down, delete its folder in `resources/`. The list rebuilds by itself.

### Your own starters ("From the author")
Put `"official": true` in a resource's `meta.json` and it shows in **From the author** with a ★ instead of the community list. `resources/faolon-rig` is the first one (the rig that ships with the mod). Only you can do this: uploads through the form never get it.

### Animated previews
The picture can be a **GIF**. In the editor's **Test** tab, pick an action (Walk, Run, Idle…), put on any wearables, then press **⏺ GIF** and choose length, size and background (see-through looks best on the site). Tell people sharing characters to do the same.

You can also add things by hand: make `resources/<id>/` with `meta.json`, a picture and the file (see `resources/faolon-rig`), then push.

## Layout
| Path | What |
|---|---|
| `index.html`, `assets/` | The website (no build step) |
| `data/mods.json` | Mods, Nexus links, editor link |
| `data/types.json` | Resource types (Rigs, Add-ons, Gear textures, Sprites, Props, Other) |
| `data/resources.json` | Made by the bot from `resources/`. Don't edit it. |
| `resources/` | Shared uploads, one folder each |
| `tools/` | The bot's scripts (`accept_issue.py`, `build_index.py`) |
| `.github/` | The upload form and the bot workflows |

Fan-made. Not made by or affiliated with the developer of *Casualties: Unknown*.
