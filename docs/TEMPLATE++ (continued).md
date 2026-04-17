In this document, Tempaltes++, or Templates Advanced is just referred to as templates. When talking about the "
oiriginal" handlebars templates, it will be mentioned explicitly.

- Templates (Advanced) are organized into sections, or packages, just as the original templates are.
- The templates come in cells
- Between each cell, there is a special separator. This separator is has a + button at the front, which allows adding a
  cell in that position. the + then shows a dropdown with the available types.
- There should be such a separator above and below each cell
- Upon processing the template, each cell is processed sequentially from top to bottom. The context is passed on from
  cell to cell, allowing cells to modify the context.
- A cell is provided a context, that is passed on to the next cell. Cells can modify or extend the context.
- A cell component is a generic component in the @xomda/ui library, provided with slots
- A cell component has an optional type (text), which is displayed as a chip.
  - The specific type used for templates, is the type of the cell, like "text", "handlebars", "logic"
- A cell component should have a slot for the "editor", and one for the "preview".
  - The preview is optional, and should be rendered above the editor.
  - Both preview and editor can be folded (collapse / expand).
- A cell component can have a delete, up and down buttons on the right side, as actions. These should be adjustable
  using props. There should also be a slot to prepend an action
- A cell component also has a toolbar-slot, which allows the user to add items next to the chip that displays the type.
- A cell component can also have vertical three dots left of the chip, which allows the user to edit the cell
  properties, instead of putting those into the toolbar.
- There should be an "Output Buffer" cell type. This output buffer presents the user with Print Stream, or something
  alike that's standard java and processable for the GraalJS too. This output buffer should be added to the context, and
  can then later be used by cells to write to. (For example, for adding imports)
- There should be a "Logic" cell type, that allows users to write JavaScript code. For the java side, this should be
  processed by the GraalJS compiler, using the esm.js option. It should be possible to import other files.
- There should be a "Handlebars" cell type, that allows users to write Handlebars templates, using the context to
  provide the data.
- The model should be available in the context somehow, to start with. It would be cool is the user could then provide
  collection of models, or packages or entities or whatever, which will then be looped over, providing single items to
  the subsequent cells. A final write-cell should then be able to write the contents to the a file.
- A general print stream, such as with the output buffer, would be nice to have in a logic cell. That way, a logic cell
  can also write code to it's own output. Or write code to another output buffer, defined before. Each non-logic cell,
  such as handlebars for example, should also have a some output buffer. it's only at the end, when the user chooses to
  write, that whatever is in these buffers, needs to effectively be written in the sequence they appear. The preview of
  the cell can be used to preview these buffers, if possible.
- There should be an Output cell type, which allows the user to select "File" and writes to a file within the project
  structure.
- The cell-types should also be modelled out in .xomda model for the project.
- The java side (lib, gradle plugin, maven plugin) should also be able to process these templates as well. So that xomda
  can live in a java-only project, or java-based build full-stack project for example.
- there should be a way to process the templates from the CLI, or vite or webpack or unplugin.
