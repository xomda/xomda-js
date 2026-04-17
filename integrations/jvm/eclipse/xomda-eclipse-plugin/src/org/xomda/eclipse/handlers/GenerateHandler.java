package org.xomda.eclipse.handlers;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.jobs.Job;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.MessageBox;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.ui.handlers.HandlerUtil;
import org.xomda.eclipse.XomdaProjectInfo;
import org.xomda.generator.XomdaGenerator;

import java.io.File;
import java.util.List;

/**
 * Runs xomda code generation on the first project in the workspace that
 * contains a {@code .xomda/model.json}. Output is written into the project
 * root. The handler offloads the work to an Eclipse {@link Job} so it
 * doesn't block the UI thread.
 */
public class GenerateHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        Shell shell = HandlerUtil.getActiveShell(event);
        XomdaProjectInfo info = findProject();
        if (info == null) {
            showMessage(shell, "Xomda", "No project with .xomda/model.json found in workspace.");
            return null;
        }
        Job job = Job.create("Xomda: generating", monitor -> {
            try {
                XomdaGenerator generator = XomdaGenerator.builder()
                    .modelFile(info.getModelFile())
                    .templatesDir(info.getTemplatesDir())
                    .outputDir(info.getRoot())
                    .build();
                List<File> generated = generator.generate();
                refreshWorkspace();
                showMessageAsync(shell, "Xomda", "Generated " + generated.size() + " file(s).");
                return org.eclipse.core.runtime.Status.OK_STATUS;
            } catch (Exception e) {
                showMessageAsync(shell, "Xomda", "Generation failed: " + e.getMessage());
                return org.eclipse.core.runtime.Status.CANCEL_STATUS;
            }
        });
        job.schedule();
        return null;
    }

    private XomdaProjectInfo findProject() {
        IWorkspaceRoot root = ResourcesPlugin.getWorkspace().getRoot();
        for (IProject project : root.getProjects()) {
            if (!project.isOpen() || project.getLocation() == null) continue;
            XomdaProjectInfo info = XomdaProjectInfo.discover(project.getLocation().toFile());
            if (info != null) return info;
        }
        return null;
    }

    private void refreshWorkspace() {
        try {
            ResourcesPlugin.getWorkspace().getRoot()
                .refreshLocal(org.eclipse.core.resources.IResource.DEPTH_INFINITE, null);
        } catch (org.eclipse.core.runtime.CoreException ignored) {
            // Stale view; user can refresh manually.
        }
    }

    private void showMessage(Shell shell, String title, String text) {
        if (shell == null) return;
        MessageBox box = new MessageBox(shell);
        box.setText(title);
        box.setMessage(text);
        box.open();
    }

    private void showMessageAsync(Shell shell, String title, String text) {
        if (shell == null) return;
        Display.getDefault().asyncExec(() -> showMessage(shell, title, text));
    }
}
