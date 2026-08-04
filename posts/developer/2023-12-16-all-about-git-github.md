---
title: All About Git & GitHub
date: 2023-12-16
slug: all-about-git-github
tags: [Git, GitHub, Version Control, Collaboration]
category: DevOps
excerpt: An introduction to Git, the open-source version control system used by most developers worldwide. Learn how Git tracks code changes, supports collaboration, and how it differs from GitHub.
readTime: 8 min read
published: true
---

## What is Git?

- Git is an open-source version control system.
- Git aids in the tracking of code changes.
- Git is used for programming collaboration.
- Git and GitHub are not the same thing.

## Why Git?

- Git is used by almost 70% of developers!
- Developers can collaborate from anywhere in the world.
- Developers can view the entire project history.
- Developers can go back to previous versions of a project.

## Features of Git

1. A file is considered modified when it is updated, added, or removed.
2. You choose which modified files to stage.
3. When the staged files are committed, Git creates a permanent snapshot of the files.
4. Git allows you to view the complete history of each commit.
5. You can undo any prior commit.
6. Git does not keep a separate copy of each file in each commit, but instead keeps track of the changes made in each commit.

## What is GitHub?

- Git is not synonymous with GitHub.
- GitHub creates Git-based tools.
- GitHub is the world's largest source code repository, and Microsoft has controlled it since 2018.

## Configuring Git for the First Time

```bash
$ git config --global user.name "<Enter your username here>"
$ git config --global user.email "<Enter your email here>"
```

## General Git Features

1. **Initializing Git** – Git now knows that it should watch the folder you initialized it in. Git creates a hidden folder to keep track of changes.
   ```bash
   $ git init
   ```
2. **Staging files / adding files to the Git repo** – Staged files are files that are ready to be committed. When you first add files to an empty repository, they are all untracked. To get Git to track them, you need to stage them, or add them to the staging environment.
   ```bash
   $ git add <filename with extension>
   ```
   Staging all files in a folder:
   ```bash
   $ git add --all
   # or
   $ git add -A
   ```
3. **Making a commit** – Adding commits to keep track of progress and changes as we work. Git considers each commit a change point or "save point" — a point in the project you can go back to if you find a bug, or want to make a change. When we commit, we should always include a message.
   ```bash
   $ git commit -m "<Enter your commit message>"
   ```
   Git commit without stage: sometimes, when you make small changes, using the staging environment seems like a waste of time. It is possible to commit changes directly, skipping the staging environment.
   ```bash
   $ git commit -a -m "<Enter your message here>"
   ```
4. **Status of files and log**
   ```bash
   $ git status
   ```
   File status in a more compact way:
   ```bash
   $ git status --short
   ```
   Log of a file: log is used to view the history of commits for a repo.
   ```bash
   $ git log
   $ git log --oneline
   ```

## Git Help

If you are having trouble remembering commands or options, use Git help.

```bash
$ git help
```

See all available options for a specific command:

```bash
$ git help --all
```

If you find yourself stuck in the list view, press `SHIFT + G` to jump to the end of the list, then `q` to exit the view.

## Git Branching

In Git, a branch is a new or separate version of the main repository. Branches allow you to work on different parts of a project without impacting the main branch. When the work is complete, a branch can be merged with the main project. You can switch between branches and work on different projects without them interfering with each other.

1. **Making a new Git branch**
   ```bash
   $ git branch "<name of branch>"
   ```
2. **Checking all available branches**
   ```bash
   $ git branch
   ```
3. **Switching to another branch**
   ```bash
   $ git checkout "<branch name>"
   ```
4. **Making a new branch and directly switching to it**
   ```bash
   $ git checkout -b "<branch name>"
   ```
5. **Deleting a branch**
   ```bash
   $ git branch -d "<branch name>"
   ```
6. **Merging two branches** – It is preferred to switch to the main/master branch before any branch is merged into it.
   ```bash
   $ git merge "<branch name>"
   ```

## Working with GitHub

Create a GitHub account to create your remote repositories, then create a new repo where we will upload our files from the local repo.

> **Note:** a local repository (repo) is the one on our system, whereas a remote repo is the one on another remote system or server — for example GitHub, GitLab, Bitbucket, etc.

1. **Push local repo to GitHub** – Copy the URL of the repo we just created (for example `https://github.com/sampleuser123/example.git`) and use it in the command below.
   ```bash
   $ git remote add origin "<copied URL here>"
   ```
   `git remote add origin` specifies that we are adding a remote repository, with the specified URL, as an origin to our local Git repo. Finally, push our master branch to the origin URL (remote repo) and set it as the default remote branch.
   ```bash
   $ git push --set-upstream origin master
   ```
2. **Pushing local repo to GitHub afterwards** – First commit all the changes, then push all the changes to our remote origin.
   ```bash
   $ git push origin
   ```
3. **Pull a branch from GitHub** – First, check which branches we have and where we are working at the moment with `git branch`. Since the new branch is not available on our local Git, use the following to see all local and remote branches.
   ```bash
   $ git branch -a
   ```
4. **Viewing only remote branches**
   ```bash
   $ git branch -r
   ```
   Now the new branch is visible in the console, but it is not available in our local repo. Check it out using `git checkout`, then run `git pull` to pull that branch into our local repo.
5. **Push a branch to GitHub** – First create a new local branch with `git checkout -b`. Check the status of the files in this branch using `git status`. Commit all the uncommitted changes using `git commit -a -m "<message>"`. Now push this branch to GitHub using `git push origin <branch>`.
6. **Clone from GitHub** – We can clone a forked repo from GitHub to our local machine. A clone is a full copy of a repository, including all logging and versions of files. Click the green "Code" button to get the clone URL, then:
   ```bash
   $ git clone "<copied URL>"
   ```
   To clone into a specific folder, add the folder name after the repository URL:
   ```bash
   $ git clone "<copied URL>" "<folder name>"
   ```

## Git Undo

1. **Git revert** – `revert` is the command we use when we want to take a previous commit and add it as a new commit, keeping the log intact. First, find the point we want to return to in the log. To avoid a very long log list, use the `--oneline` option which gives one line per commit showing the first seven characters of the commit hash and the commit message.
   - Revert the latest commit and commit the change:
     ```bash
     $ git revert HEAD --no-edit
     ```
   - Revert to earlier commits: `git revert HEAD~x` (x being a number — 1 goes back one commit, 2 goes back two, etc.)
2. **Git reset** – `reset` is the command we use when we want to move the repository back to a previous commit, discarding any changes made after that commit. First, get the seven-character commit hash from the log, then reset the repository back to that specific commit.
   ```bash
   $ git reset "<commithash>"
   ```
   Even though the commits are no longer showing up in the log, they are not removed from Git. If we know the commit hash, we can reset back to it using `git reset`.
3. **Git amend** – `commit --amend` is used to modify the most recent commit. It combines changes in the staging environment with the latest commit and creates a new commit. This new commit replaces the latest commit entirely. One of the simplest things you can do with `--amend` is to change a commit message.
   ```bash
   $ git commit --amend -m "<Commit Message>"
   ```
   Adding files with `--amend` works the same way — just add them to the staging environment before committing.
