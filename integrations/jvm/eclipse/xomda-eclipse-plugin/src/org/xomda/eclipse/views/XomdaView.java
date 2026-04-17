package org.xomda.eclipse.views;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.swt.SWT;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Tree;
import org.eclipse.swt.widgets.TreeItem;
import org.eclipse.ui.part.ViewPart;
import org.xomda.eclipse.XomdaModelReader;
import org.xomda.eclipse.XomdaProjectInfo;

import java.io.File;
import java.io.IOException;

/**
 * Workbench view that lists every xomda project found in the workspace and,
 * for each, a tree of packages → entities/enums plus the templates folder.
 */
public class XomdaView extends ViewPart {

    private Tree tree;

    @Override
    public void createPartControl(Composite parent) {
        tree = new Tree(parent, SWT.BORDER | SWT.SINGLE);
        refresh();
    }

    @Override
    public void setFocus() {
        if (tree != null) tree.setFocus();
    }

    public void refresh() {
        if (tree == null || tree.isDisposed()) return;
        tree.removeAll();
        IWorkspaceRoot root = ResourcesPlugin.getWorkspace().getRoot();
        for (IProject project : root.getProjects()) {
            if (!project.isOpen() || project.getLocation() == null) continue;
            XomdaProjectInfo info = XomdaProjectInfo.discover(project.getLocation().toFile());
            if (info == null) continue;
            TreeItem projectItem = new TreeItem(tree, SWT.NONE);
            projectItem.setText(project.getName());
            populate(projectItem, info);
            projectItem.setExpanded(true);
        }
    }

    private void populate(TreeItem parent, XomdaProjectInfo info) {
        try {
            XomdaModelReader.XomdaModel model = XomdaModelReader.read(info.getModelFile());
            TreeItem modelNode = new TreeItem(parent, SWT.NONE);
            modelNode.setText("Model (" + model.version + ")");
            for (XomdaModelReader.XomdaPackage pkg : model.packages) {
                packageNode(modelNode, pkg);
            }
        } catch (IOException e) {
            TreeItem errorNode = new TreeItem(parent, SWT.NONE);
            errorNode.setText("Failed to read model.json: " + e.getMessage());
        }

        TreeItem templatesNode = new TreeItem(parent, SWT.NONE);
        templatesNode.setText("Templates");
        File templatesDir = info.getTemplatesDir();
        if (templatesDir.isDirectory()) {
            walkTemplates(templatesNode, templatesDir, templatesDir);
        }
    }

    private void packageNode(TreeItem parent, XomdaModelReader.XomdaPackage pkg) {
        TreeItem node = new TreeItem(parent, SWT.NONE);
        node.setText("📦 " + pkg.name);
        for (XomdaModelReader.XomdaPackage child : pkg.packages) packageNode(node, child);
        for (XomdaModelReader.XomdaNamed e : pkg.entities) {
            TreeItem item = new TreeItem(node, SWT.NONE);
            item.setText("🏷 " + e.name);
        }
        for (XomdaModelReader.XomdaNamed e : pkg.enums) {
            TreeItem item = new TreeItem(node, SWT.NONE);
            item.setText("∑ " + e.name);
        }
    }

    private void walkTemplates(TreeItem parent, File dir, File templatesRoot) {
        File[] entries = dir.listFiles();
        if (entries == null) return;
        for (File entry : entries) {
            if (entry.isDirectory()) {
                walkTemplates(parent, entry, templatesRoot);
            } else if (entry.isFile() && entry.getName().endsWith(".template.json")) {
                String rel = entry.getAbsolutePath().substring(templatesRoot.getAbsolutePath().length() + 1);
                TreeItem item = new TreeItem(parent, SWT.NONE);
                item.setText(rel);
            }
        }
    }
}
