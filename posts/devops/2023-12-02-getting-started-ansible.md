---
title: Getting Started with Ansible
date: 2023-12-02
slug: getting-started-ansible
tags: [Ansible, Automation, DevOps, Configuration Management]
category: Automation
excerpt: A practical introduction to Ansible, the open-source automation engine for cloud provisioning, application deployment, and IT orchestration. Learn how control and remote machines work together in a typical Ansible setup.
readTime: 6 min read
published: true
---
**Ansible** is a straightforward open-source IT engine that automates cloud provisioning, in-service orchestration, application deployment, and many other IT technologies.

**Control machine:** A system that serves as a hub for managing other machines.

**Remote machine:** Machines that the control machine manages and controls.

![Getting Started with Ansible](https://upload.wikimedia.org/wikipedia/commons/2/24/Ansible_logo.svg)

## Install Ansible

```bash
$ sudo apt-get update
$ sudo apt-get install software-properties-common
$ sudo apt-add-repository ppa:ansible/ansible
$ sudo apt-get update
$ sudo apt-get install ansible
```

## Understanding YAML

Every **YAML** file optionally starts with `---` and ends with `...`.

### Dictionary

YAML uses a simple key-value pair to represent the data. The dictionary is represented as a `key: value` pair.

```yaml
--- # Optional YAML start syntax
james:
  name: james john
  rollNo: 34
  div: B
  sex: male
... # Optional YAML end syntax
```

```yaml
James: {name: james john, rollNo: 34, div: B, sex: male}
```

### List

Every element (member) of a list should be written on a new line with the same indentation starting with `- ` (dash and space).

```yaml
---
countries:
  - America
  - China
  - Canada
  - Iceland
...
```

Output: `Countries: ['America', 'China', 'Canada', 'Iceland']`

### New line

YAML uses `|` to include newlines while showing multiple lines, and `>` to suppress newlines while showing multiple lines.

```yaml
---
messageIncludeNewLines: |
  Congratulations!!
  You passed with 79%
messageExcludeNewLines: >
  Congratulations!!
  You passed with 79%
...
```

## Parallelism and Shell Commands

Before performing any Ansible shell command, add the key to the controller machine.

```bash
$ ssh-agent bash
$ ssh-add ~/.ssh/id_rsa
```

- **Reboot all systems**

```bash
$ ansible abc -a "/sbin/reboot" -f 12
$ ansible abc -a "/sbin/reboot" -f 12 -u username   # by username
```

- **File transfer**

```bash
$ ansible abc -m copy -a "src=/etc/yum.conf dest=/tmp/yum.conf"
```

- **Creating a new directory**

```bash
$ ansible abc -m file -a "dest=/path/user1/new mode=777 owner=user1 group=user1 state=directory"
```

- **Deleting a directory and its files**

```bash
$ ansible abc -m file -a "dest=/path/user1/new state=absent"
```

- **Managing packages**

The following command checks whether a YUM package is installed, but does not update it.

```bash
$ ansible abc -m yum -a "name=demo-tomcat-1 state=present"
```

The following command checks that the package is not installed.

```bash
$ ansible abc -m yum -a "name=demo-tomcat-1 state=absent"
```

The following command checks that the latest version of the package is installed.

```bash
$ ansible abc -m yum -a "name=demo-tomcat-1 state=latest"
```

- **Gathering facts**

```bash
$ ansible all -m setup
```

## Playbook Structure

Create a playbook:

```yaml
---
- name: install and configure DB
  hosts: testServer
  become: yes
  vars:
    oracle_db_port_value: 1521
  tasks:
    - name: Install the Oracle DB
      yum: <code to install the DB>
    - name: Ensure the installed service is enabled and running
      service:
        name: <your service name>
```

### The different YAML tags

- **name** – Specifies the name of the Ansible playbook
- **hosts** – Specifies the lists of hosts or host groups against which we want to run the task
- **vars** – Lets you define variables which you can use in your playbook
- **tasks** – All playbooks should contain tasks or a list of tasks to be executed

## Roles

Roles provide a framework for fully independent or interdependent collections of variables, tasks, files, templates, and modules.

- Each role is a directory tree in itself
- `$ ansible-galaxy -h`

### Creating a role directory

```bash
$ ansible-galaxy init ashwanirole
```

### File structure of an Ansible role

```text
roles/
    common/               # this hierarchy represents a "role"
        tasks/
            main.yml      # <-- tasks file can include smaller files if warranted
        handlers/
            main.yml      # <-- handlers file
        templates/
            ntp.conf.j2   # <-- templates end in .j2
        files/
            bar.txt       # <-- files for use with the copy resource
            foo.sh        # <-- script files for use with the script resource
        vars/
            main.yml      # <-- variables associated with this role
        defaults/
            main.yml      # <-- default lower priority variables for this role
        meta/
            main.yml      # <-- role dependencies
        library/          # roles can also include custom modules
        module_utils/     # roles can also include custom module_utils
        lookup_plugins/   # or other types of plugins, like lookup in this case
    webtier/              # same kind of structure as "common" was above
    monitoring/
    fooapp/
```

Details about the file structure:

- `tasks/main.yml` – the main list of tasks that the role executes
- `handlers/main.yml` – handlers which may be used within or outside this role
- `library/my_module.py` – modules which may be used within this role
- `defaults/main.yml` – default variables for the role; these have the lowest priority and can easily be overridden by any other variable
- `vars/main.yml` – other variables for the role
- `files/main.yml` – files that the role deploys
- `templates/main.yml` – templates that the role deploys
- `meta/main.yml` – metadata for the role, including role dependencies and optional Galaxy metadata

## Variables

```yaml
- hosts: <your hosts>
  vars:
    tomcat_port: 8080
```

In the above example, we defined a variable named `tomcat_port` and assigned the value `8080`. It can be used in the playbook wherever needed using `{{ output }}` syntax.

## Exception Handling in Playbooks

```yaml
tasks:
  - name: Name of the task to be executed
    block:
      - debug: msg = 'Just a debug message, relevant for logging'
      - command: <the command to execute>
    rescue:
      - debug: msg = 'There was an exception.'
      - command: <rescue mechanism for the above exception>
    always:
      - debug: msg = "this will execute in all scenarios. Always will get logged"
```

## Loops

```yaml
---
- hosts: tomcat-node
  tasks:
    - name: Install Apache
      shell: "ls *.war"
      register: output
      args:
        chdir: /opt/ansible/tomcat/demo/webapps
    - file:
        src: '/opt/ansible/tomcat/demo/webapps/{{ item }}'
        dest: '/users/demo/vivek/{{ item }}'
        state: link
      with_items: "{{output.stdout_lines}}"
```

## Blocks

The playbook in totality is broken into blocks. The smallest piece of steps to execute is written as a block. Writing specific instructions in blocks helps to segregate functionality and handle exceptions if needed.

## Conditionals

```yaml
---
- hosts: all
  vars:
    test1: "Hello Ashwani"
  tasks:
    - name: Testing Ansible variable
      debug:
        msg: "Equals"
      when: test1 == "Hello Ashwani"
```

Here `when` defines the condition that must match.

## How to Limit Execution by Tasks

This is an important strategy when you want to execute only one task and not the entire playbook. For example, suppose you want to stop a server during a production issue, and after applying a patch you only want to start the server again.

Add tags like the following:

```yaml
- {role: start-tomcat, tags: ['install']}
```

Use tags when running the playbook:

```bash
$ ansible-playbook -i hosts <your yaml> --tags "install" -vvv
```

For example:

```yaml
- hosts: <A>
  environment: "{{your env}}"
  pre_tasks:
    - debug: msg = "Started deployment. Current time is {{ansible_date_time.date}} {{ansible_date_time.time}}"
  roles:
    - {role: <your role>, tags: ['<respective tag>']}
  post_tasks:
    - debug: msg = "Completed deployment. Current time is {{ansible_date_time.date}} {{ansible_date_time.time}}"
```

## How to Limit Execution by Hosts

Pass a specific host address via `--extra-vars`:

```yaml
# file: user.yml (playbook)
---
- hosts: '{{ target }}'
  user: ...
```

Running the playbook:

```bash
$ ansible-playbook user.yml --extra-vars "target=<your host variable>"
```

If `{{ target }}` is not defined, the playbook does nothing. A group from the hosts file can also be passed through, which does not harm if the extra vars are not provided.

- Playbook targeting a single host:

```bash
$ ansible-playbook user.yml --extra-vars "target=<your hosts variable>" --listhosts
```

## Troubleshooting

Debug and Register are two modules available in Ansible. For debugging, use the two modules judiciously.

Use verbosity levels: you can run commands with verbosity level one (`-v`) or two (`-vv`).

## Common Playbook Issues

- Quoting
- Indentation

A playbook is written in YAML format, and the above are the most common issues. YAML does not support tab-based indentation and only supports space-based indentation, so be careful about it.

> **Tip:** once you are done writing the YAML, open [editor.swagger.io](https://editor.swagger.io/) and paste your YAML on the left-hand side to ensure it compiles properly. Swagger flags errors as well as warnings.
