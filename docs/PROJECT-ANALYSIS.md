# project analysis

<small>(xoMDA goals)</small>

## workings

As the application is started, the folder structure gets inspected to detect any known projects / files, plugins, for
example: Rust, Visual Studio, VS Code, IntelliJ, Webpack, ... (or .idea in general, of the jetbrains app distinguishment
itself is a problem), but also maven, Gradle, ant, typescript, vite, webpack, prettier, eslint, stylelint, but
not to forget, also .xomda itself.

- these will require one or more pattern that will be recognized, for example: “is a certain file present?”, or “does a
  certain file contain a certain content?” (Advanced)
- these will be plugins (except for maybe .xomda itself), either in separate sub- sub-packages (
  @xomda/plugin-analysis-eslint). I would then prefer to locate these package not directly under the packages folder,
  but under the analysis (or whatever) folder.
- will these also take care of the icon of a file / folder?

This requires a very secure but diligent usage of resources, so it must be efficient. These sub-packages, or plugins in
any form either way, need to do their thing at the time the analysis system requires it to. Maybe the plugins need to be
scanned and grouped by… up front, so that they can interact on the moment of the group’s “key”.

Project analysis will also require a “xomda Project” (which is — even currently already — stored under
the /.xomda folder) It's the .xomda plugin, so it needs to be present at all times. (even without any plugin?)

plugins may later offer updating dependencies, or have a custom view for a file for example

