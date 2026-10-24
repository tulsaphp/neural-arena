# 🧠 Neural Arena: AI Engineering Championship

**A multiplayer strategy game inspired by artificial intelligence and machine learning.**

Neural Arena is a browser-based educational game where players compete in AI-inspired challenges involving model selection, debugging, and intelligent decision-making. Built with HTML, CSS, JavaScript, and Supabase, the project explores multiplayer web development and interactive learning through game mechanics.

> **Project status:** Educational project in development.

## 🎮 Overview

Neural Arena brings AI engineering concepts into a competitive multiplayer environment. Players join a shared game room, complete three challenge rounds, earn points, and compete for the highest score.

The project combines interactive gameplay with practical web technologies to demonstrate how browser applications can communicate with a cloud database and support multiplayer experiences.

## ✨ Features

* **Multiplayer gameplay:** Designed for 2–4 players per room.
* **Room-based sessions:** Create or join a game using a room code.
* **AI-inspired challenges:** Explore concepts related to model selection, data leakage, and strategy.
* **Three competitive rounds:** Make decisions and accumulate points.
* **Browser-based interface:** Play through a web browser without installing a desktop application.
* **Supabase integration:** Backend infrastructure for authentication, room data, and real-time updates.
* **Responsive design:** Designed to support different screen sizes.
* **Static deployment:** Can be hosted using GitHub Pages.

*Feature availability depends on the backend configuration and successful deployment.*

## 🕹️ Game Modes

### Round 1 — Train the Brain

Explore model selection using a simplified sensor dataset. Players choose between different approaches to classification and prediction.

### Round 2 — Debug the Machine

Identify a solution to a machine-learning data leakage problem and learn why preprocessing must be fitted using training data only.

### Round 3 — Agent Battle

Choose an agent strategy and compete in a simulated environment where decisions influence the outcome.

The game combines scores from the rounds to determine the winner.

## 🛠️ Technology Stack

| Technology   | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| HTML5        | Application structure                                  |
| CSS3         | Styling and responsive layout                          |
| JavaScript   | Gameplay and client-side interactions                  |
| Supabase     | Authentication, database, and real-time infrastructure |
| SQL          | Database setup, policies, and backend logic            |
| GitHub       | Source control and collaboration                       |
| GitHub Pages | Static website hosting                                 |

## 📁 Project Structure

```text
neural-arena/
├── index.html
├── styles.css
├── app.js
├── config.js
├── favicon.svg
├── supabase-setup.sql
├── README.md
├── LICENSE
└── .nojekyll
```

The structure above describes the intended project layout. Individual files may vary depending on the current version.

## 🚀 Getting Started

### Prerequisites

* A modern web browser.
* Python 3 or another local static HTTP server.
* A Supabase project for multiplayer functionality.

### 1. Clone the repository

```bash
git clone https://github.com/tulsaphp/neural-arena.git
cd neural-arena
```

### 2. Configure Supabase

Create a project at [Supabase](https://supabase.com/).

Open the Supabase SQL Editor and execute the SQL setup script from `supabase-setup.sql`.

If the application uses anonymous authentication, enable Anonymous Sign-Ins in the project's authentication settings.

Review the database policies and function permissions before allowing public access.

### 3. Configure the application

Update `config.js` with the Supabase project URL and public publishable key.

The configuration format expected by the application is:

```javascript
window.NEURAL_ARENA_CONFIG = {
    SUPABASE_URL: "YOUR_SUPABASE_PROJECT_URL",
    SUPABASE_ANON_KEY: "YOUR_SUPABASE_PUBLISHABLE_KEY"
};
```

Replace the placeholders with your own project values.

**Security:** Only use a Supabase publishable key in browser code. Never expose a secret key, `service_role` key, or database password. Public client keys are not a substitute for database security policies.

### 4. Run locally

Start a local HTTP server from the project directory:

```bash
python -m http.server 8080
```

Open the application at:

http://localhost:8080

Stop the server with `Ctrl+C` when finished.

### 5. Deploy with GitHub Pages

1. Push the project files to the `main` branch.
2. Open the repository's **Settings**.
3. Select **Pages**.
4. Choose **Deploy from a branch**.
5. Select `main` and the `/ (root)` directory.
6. Save the settings and wait for deployment.

The intended public URL is:

https://tulsaphp.github.io/neural-arena/

The website will be available after GitHub Pages successfully deploys the project.

## 🔐 Security Considerations

Neural Arena uses Supabase for its backend infrastructure.

Before deploying or accepting public players:

* Enable Row Level Security on exposed database tables.
* Review read and write policies for rooms and players.
* Verify that room membership checks are correct.
* Validate scoring and game-state transitions on the server.
* Avoid granting browser clients unrestricted database write access.
* Keep private credentials out of source control.

The actual security of the deployed application depends on its SQL functions, database policies, and application implementation.

## 🧪 Testing

Suggested testing areas include:

* Room creation and joining.
* Multiplayer interaction across separate browser sessions.
* Authentication and session handling.
* Round progression and scoring.
* Real-time updates.
* Error handling when the backend is unavailable.
* Responsive layout and browser compatibility.

## 🎯 Project Goals

Neural Arena explores the intersection of:

* AI and machine-learning education.
* Interactive game design.
* Full-stack web development.
* Real-time multiplayer applications.
* Database security and server-side validation.
* AI-assisted software engineering.

## 🤝 Contributing

Contributions, suggestions, bug reports, and improvements are welcome.

To contribute:

1. Fork the repository.
2. Create a branch for your changes.
3. Implement and test your changes.
4. Submit a pull request describing your contribution.

Please avoid including secrets, credentials, or private user data in commits and issue reports.

## 📄 License

See the [`LICENSE`](LICENSE) file for the applicable license terms.

---

**Neural Arena** — Learn AI concepts. Make strategic decisions. Compete and improve.
