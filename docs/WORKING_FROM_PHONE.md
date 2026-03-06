# Working on Trade Mouldings from your iPhone

Ways to keep developing when you’re away from your laptop.

---

## Option 1: Cursor AI Mobile (if you have a Mac)

- **App:** [Cursor AI Mobile](https://apps.apple.com/app/cursor-mobile-remote-ide/id6755931330) on the App Store (iPhone/iPad, iOS 17+).
- Prompts you send on the phone run in Cursor on your **Mac** (same Apple ID, iCloud, Cursor CLI installed).
- Chat and project context sync between phone and desktop.
- **Note:** The app is designed to talk to Cursor on **macOS**. If your main dev machine is **Windows**, use Option 2 or 3 below.

---

## Option 2: GitHub + cloud IDE (works with Windows laptop)

Use the same repo from your phone in a browser.

1. **Push this project to GitHub** (if not already):
   - Create a repo on GitHub, then:
   - `git init` (in project folder), add remote, commit, push.
2. **Open the repo from your iPhone:**
   - **GitHub Codespaces** (browser): github.com → your repo → **Code** → **Codespaces** → create/open. You get a VS Code–style environment in the browser; you can type prompts in the Copilot/Chat panel.
   - **VS Code for Web**: vscode.dev → sign in with GitHub → open your repo. Works in Safari on iPhone.
3. **Sync back to your laptop:** Commit and push from the cloud IDE; pull on your laptop when you’re back.

Your **Cursor** project stays on the laptop; the cloud copy is for editing from the phone. Merge changes (e.g. pull from GitHub into Cursor) when you’re back at the laptop.

---

## Option 3: Remote desktop to your Windows laptop

Use your iPhone as a screen and keyboard for the same machine where Cursor runs.

1. **Leave your laptop on** (and awake, or “wake on LAN” if you set it up).
2. **Install a remote desktop app on the laptop and phone:**
   - **Chrome Remote Desktop**: Install on Windows, enable remote access, then from iPhone install “Chrome Remote Desktop” and connect.
   - **Microsoft Remote Desktop**: Set up your PC for RDP and use the “Microsoft Remote Desktop” app on iPhone.
3. **On the phone:** Open the remote app, connect to your laptop, then open Cursor and continue as usual. Everything runs on the laptop; you’re just controlling it from the phone.

Best when you have a good connection and don’t mind the small screen.

---

## Recommendation

- **Laptop is Windows:** Prefer **Option 2** (GitHub + Codespaces or vscode.dev) for “real” coding from the phone, or **Option 3** (remote desktop) to use Cursor exactly as on the laptop.
- **Laptop is Mac:** Use **Option 1** (Cursor Mobile) for quick prompts, or Option 2/3 as above.

---

## One-time setup that helps all options

1. **Use Git:** Keep the project in a Git repo and push to GitHub (or another remote) regularly so you always have a backup and can open it from anywhere.
2. **Env in one place:** Keep `.env` / Supabase keys only on the laptop (or in a secure place); don’t commit them. Cloud IDEs can use their own env or GitHub Secrets if you add CI later.
3. **Same branch:** When you work from phone (cloud IDE or Cursor Mobile + Mac), use the same branch (e.g. `main`) and pull/push so the laptop and phone stay in sync.

Once this is set up, you can send prompts and continue building from your iPhone whether you use Cursor Mobile (Mac), a cloud IDE, or remote desktop.
