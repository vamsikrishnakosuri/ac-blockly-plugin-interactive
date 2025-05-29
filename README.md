# ac-blockly-plugin

The `ac-blockly-plugin` is an accessible Blockly plugin designed to enhance block-based programming environments with
inclusive features like keyboard navigation and screen reader support.

## Installation

To install the dependencies for this project, run the following command:

```bash
npm install
```

This will install all the required dependencies listed in the `package.json` file.

## Usage

Once the dependencies are installed, you can build the project using the following command:

```bash
npm run build
```

This will create the production build of the project using the `blockly-scripts build` command.

### Integration to Blockly project

Copy the build files from `dist` path to your project directory. Then initiate a `NavigationController` to activate
the plugin like below.

```js
let nav = new NavigationController();
nav.init();
nav.addWorkspace(workspace);
```

## Project Structure

Here is a brief overview of the project structure:

```
ac-blockly-plugin/
├── dist/                 # build files
├── src/                  # source code directory
│   ├── cursors/          # cursors related files
│   ├── audio/            # screen readers and audio cues related files
│   ├── index.js          # entry file for the plugin
├── package.json          # project configuration and dependencies
├── README.md             
└── LICENSE              
```

## Author

Blockly Team (UNT)

## Description

This project is a plugin designed to make block-based programming environments like Google Blockly more accessible to
users with disabilities. It includes features such as keyboard navigation and screen reader support to improve the
usability and accessibility of these environments.
