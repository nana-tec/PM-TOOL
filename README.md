<p align="center"><img src="/resources/docs/banner.jpg"></p>

LaraCollab, developed with Laravel and React, serves as a project management tool. The primary idea behind this initiative is to provide developers or development companies with a free platform to efficiently manage clients, projects, log time, and generate invoices. You may wonder, 'Why another tool when there are already feature-rich options available for free?' Yes, that's a valid point. However, my aim is to offer a project management tool specifically tailored for Laravel developers, giving them option to integrate and customize features according to their unique workflows.

## Features

- User roles (e.g., client, manager, developer, designer) with customizable permissions.
- Management of client companies.
- Manage client users that have access to company tasks.
- Project management with user access control.
- Task groups within projects (e.g., Todo, In progress, QA, Done, Deployed).
- Task can have a assignee, due date, custom labels, time estimation (add manually or use timer), attachments, subscribers, and comments.
- Task filters for efficient organization.
- Real-time notifications and task updates via web sockets.
- Mention functionality in task descriptions and comments.
- Personalized "My Tasks" page for each user.
- Activity page for projects or selected ones.
- Invoice generation from billable tasks with logged time.
- Print or download invoices directly from the platform.
- Dashboard offering project progress, overdue tasks, recently assigned tasks, and recent comments.
- Additional reports for daily logged time per user and total logged time.
- Dark mode support for user preference.
- Version control integration (GitHub/GitLab): view branches/commits, issues, pull/merge requests, reviews, status checks, and compare changes with inline diffs.

## Screenshots

<p align="center">
<img src="/resources/docs/screenshots/Dashboard - light.jpeg" width="45%">
<img src="/resources/docs/screenshots/Dashboard - dark.jpeg" width="45%">
</p>
<p align="center">
<img src="/resources/docs/screenshots/Projects - light.jpeg" width="45%">
<img src="/resources/docs/screenshots/Projects - dark.jpeg" width="45%">
</p>
<p align="center">
<img src="/resources/docs/screenshots/Project tasks - light.jpeg" width="45%">
<img src="/resources/docs/screenshots/Project tasks - dark.jpeg" width="45%">
</p>
<p align="center">
<img src="/resources/docs/screenshots/Task - light.jpeg" width="45%">
<img src="/resources/docs/screenshots/Task - dark.jpeg" width="45%">
</p>
<p align="center">
<img src="/resources/docs/screenshots/My tasks - light.jpeg" width="45%">
<img src="/resources/docs/screenshots/My tasks - dark.jpeg" width="45%">
</p>
<p align="center">
<img src="/resources/docs/screenshots/Activity - light.jpeg" width="45%">
<img src="/resources/docs/screenshots/Activity - dark.jpeg" width="45%">
</p>
<p align="center">
<img src="/resources/docs/screenshots/Invoice - light.jpeg" width="45%">
<img src="/resources/docs/screenshots/Invoice - dark.jpeg" width="45%">
</p>

## Tech stack

[Laravel](https://laravel.com) for backend, [React](https://react.dev) for frontend and [Inertia](https://inertiajs.com) for "glueing" them together. For the frontend React UI components, the awesome [Mantine](https://mantine.dev) library was used.

## Version control (GitHub/GitLab)

LaraCollab includes a Version Control panel inside each project that connects to GitHub or GitLab so you can open PRs/MRs, review changes, and merge without leaving the app.

What you can do

- Browse branches, commits, issues, and pull/merge requests with pagination.
- Open PRs/MRs via a dialog (source/target branch, title, description; draft supported on GitHub).
- See PR/MR details: mergeability, draft status, head SHA, status checks (classic + GitHub Actions check-runs), required checks (GitHub), and current reviewers.
- Request reviewers with a list picker.
- Add comments on PRs/MRs and on issues (with pagination of comments).
- Compare branches/PRs and preview inline diffs per file:
  - Unified and side-by-side modes
  - Expand/Collapse all files
  - Copy-to-clipboard for individual patches or all patches
  - Export compare results to CSV/JSON
- Merge using supported strategies (merge/squash/rebase depending on provider).
- "Merge when ready" (GitHub): enabled only when required checks pass and PR is not a draft.
- Convert draft PRs to ready-for-review (GitHub).

Setup

1. Open a project and locate the Version control panel.
2. Pick a provider (GitHub/GitLab).
3. Enter the repository identifier:
   - GitHub: owner/repo (e.g. `acme/my-repo`)
   - GitLab: group/subgroup/project (e.g. `group/my-app`); add Base URL for self-hosted GitLab (e.g. `https://gitlab.example.com`).
4. Optionally set the default branch (e.g. `main`).
5. Add a Project access token (PAT) if you want a project-level token available to everyone.
6. Optionally, save your Personal token in the panel and enable "Use my personal token for API calls" if you prefer user-level auth. Your token is only used for your requests.

Token scopes

- GitHub: repo-level scopes sufficient to read/write PRs, statuses, and requested reviewers. For public repos, `public_repo` may be sufficient; for private repos, use `repo`.
- GitLab: `api` or a combination of `read_api`, `read_repository`, and `write_repository` for creating MRs and posting comments.

Using the panel

- Branches/Commits/Issues/PRs are paginated; use "Load more" to fetch additional pages.
- Open PR/MR: choose source/target branches, provide title/body; on GitHub you can create as Draft.
- PR Details: view mergeability and draft; see statuses and required checks; refresh statuses; request reviewers; add comments; and select a merge strategy.
- "Merge when ready" (GitHub): the button is disabled until required checks pass and the PR is not a draft. It’s enabled automatically once everything is green.

Compare and diffs

- Open Compare from a PR or manually set Base and Head.
- "PR number" helper auto-fills base/head and loads the compare.
- Per-file inline diffs support:
  - Unified/Side-by-side rendering
  - Expand/Collapse all files
  - Copy patch per-file or all patches at once
  - Export compare results to CSV or JSON

Troubleshooting

- GitHub: 422 "Validation Failed" for PR create (base invalid)
  - Ensure the target/base branch exists and your token has access. For forks, specify the head as `owner:branch`.
- GitHub: 422 on merge with message mentioning `links/1/schema`
  - Ensure the PR is mergeable (no conflicts), up to date with base, required checks have passed, and your token has permission to merge.
- Rate limit exceeded (403)
  - Wait for limits to reset or switch to a different token (toggle personal vs project token in the panel).
- Scrollbars in lists/diffs
  - Scrollbars are always visible in the VCS lists and diff panes for easier mouse interaction. If your OS hides scrollbars, hovering or scrolling should reveal them.

## Setup

### Project

1. Clone the repository using `git clone https://github.com/vstruhar/lara-collab.git`
2. Cd into the project
3. Install npm dependencies with `npm install`
4. Copy the `.env` file with `cp .env.example .env`
5. Generate an app encryption key with `php artisan key:generate`
6. Create an empty database for the application
7. In the `.env` file, add database credentials to allow Laravel to connect to the database (variables prefixed with `DB_`)
8. Migrate the database with `php artisan migrate --seed`

#### Development

9. You will be asked if you want to seed development data, for testing or development enter `yes`.
10. Install composer dependencies with `composer install`
11. Run `npm run dev`

> NOTE: [Laravel Sail](https://laravel.com/docs/10.x/sail#introduction) was used for development, so if you want you can use that.

#### Production

9. You will be asked if you want to seed development data, for production enter `no`.
10. Run `composer install --no-dev` to install project dependencies.
11. Run `php artisan optimize` to optimize Laravel for production.
12. Run `php artisan storage:link` to create symbolic link for storage in public directory.
13. Setup [task scheduler](https://laravel.com/docs/10.x/scheduling#running-the-scheduler) by adding this to cron (to edit cron run `crontab -e`).
    `* * * * * cd /path-to-your-project && php artisan schedule:run >> /dev/null 2>&1`
14. Emails, notifications and events are queueable. If you want to enable queues then you will have to set `QUEUE_CONNECTION=database` in `.env`. And then run [queue worker](https://laravel.com/docs/10.x/queues#running-the-queue-worker) with [supervisor](https://laravel.com/docs/10.x/queues#supervisor-configuration) using this command `php artisan queue:work --queue=default,email`.
15. Setup email by updating variables in `.env` that have `MAIL_` prefix.
16. Finally build frontend with `npm run build`.

### Admin user

New admin user will be created after running migrations with seed.

email: `admin@mail.com`

password: `password`

### Web sockets

You may use [Pusher](https://pusher.com) for web sockets, since number of free messages should be enough for the use case. Or you can use [open source alternatives](https://laravel.com/docs/10.x/broadcasting#open-source-alternatives).

To use Pusher, sign up, then create a project and copy paste app keys to `.env` (variables with `PUSHER_` prefix).

### Social login (Google)

1. Setup "OAuth consent screen" on Google Console ([link](https://console.cloud.google.com/apis/credentials/consent)).
2. Create "OAuth Client ID", select Web application when asked for type ([link](https://console.cloud.google.com/apis/credentials)).
3. Use generated "Client ID" and "Client secret" in the `.env` (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`).

## Roadmap

- [x] Kanban view.
- [x] Report that will calculate expense and profit per user.
- [x] Add project notes section.
- [x] Multiple users should be able to log time on a task
- [x] Add history of changes to the task.
- [ ] Change specific permission per user.
- [ ] Make it responsive.
- [ ] Add emojis to rich text editor.
- [ ] Write tests.
- [ ] Optimize frontend and backend.
- [ ] Consider moving to TypeScript.
