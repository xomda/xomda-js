## xomda

# MDA

- model driven architecture is the core of xomda.
- a project with a .xomda folder in it that contains the expected files in it, is a xomda project and can be opened with
  the xomda client. the core usage for xomda at this stage is to provide a way to define a model, both as a file that
  can be checked in in the repo and modified manually, there will also be a xomda client to present a visual interface
  to the user.
- the xomda source code repo itself, will also use a .xomda folder and define a model. that model is the core xomda
  model, from which end-users of xomda will then extend their models from. this model describes which elements are part
  of the model (it's describing). it's a loop. it will also define which elements to read and write from and to the json
  file, or which fields to show on a (dynamic) form that edits this entity, or enum, or whatever (that's defined in the
  model).
- it's okay that xomda its own model needs to be regenerated for the changes to become apparent. They will affect the
  source code, such as they will on any project xomda is used.
- so, what the application show, are packages and entities and enums and such. they have a visual representation which
  is predetermined
- the json file that contains the model, should be predictable, in the sense that objects and attributes should not
  switch position suddenly.
- this is for xomda using xomda, not for end-user-projects that use xomda: ideally, their is a serializer and
  deserializer, that uses the generated .xomda model, to serialize and deserialize the json.
- this is for xomda using xomda, not for end-user-projects that use xomda: ideally, the generated .xomda code is used to
  know how to display a form for an entity.

# templates (advanced)

- templates are use to turn the model into artifacts, most probably as code.
- templates are composed of vertical cells, which contain specific functionality and are rendered sequentially.
- each template cell has a context upon which it works and which it can alter and enrich, and which it passes on to the
  next cell.
- a template starts with a provider cell, that provides an iterator of data, through a generator function. this can be
  done manually, or through a select box that selects the iterable collection to be used.
- each template cell (or most of them at least) has an output buffer, which is what will get written at the end. the
  output buffers together combined, form the final output that will be written to the a file, for example
- each template ends with an output cell, that will write the total output buffer as contents to a file, for example.
- there is a handlebars cell type that will use the buffer as context for the handlebars template
- cells can be added, removed, or switched places.
- each cell has a preview that can be collapsed, that will display the relevant preview for a cell. for a javascript
  cell for example, this preview will be a json view of the context that's been altered by the cell.

# user interface

- the xomda client is a ui for the xomda node backend
- the ui should be modern and professional
- the ui consists of reusable components, from vuetify of derived components in the @xomda/ui package
- each page should use the same base-components and principles, to ensure a consistent layout
- material symbols are used as icons. not with heavy strokes, but thin strokes.
