package org.xomda.generator.template;

import java.util.ArrayList;
import java.util.List;

/**
 * Migrates legacy flat-shape templates into the hierarchical loop+children
 * shape used by the current engine. Mirrors the TypeScript
 * {@code normalizeTemplate} so JVM consumers can load old templates too.
 *
 * Cell-type tolerance ("provider" → LOOP, "provider-logic" → LOOP_LOGIC) is
 * already handled by {@link CellType#fromValue(String)}; this class handles
 * the structural migration (siblings after a loop become children).
 */
public final class TemplateNormalizer {

    private TemplateNormalizer() {}

    public static void normalize(Template template) {
        if (template == null || template.getCells() == null) return;
        template.setCells(nestFlatChildren(template.getCells()));
    }

    private static List<TemplateCell> nestFlatChildren(List<TemplateCell> cells) {
        if (cells == null) return null;
        List<TemplateCell> result = new ArrayList<>();
        for (int i = 0; i < cells.size(); i++) {
            TemplateCell cell = cells.get(i);
            if (cell.isLoop() && (cell.getChildren() == null || cell.getChildren().isEmpty())) {
                List<TemplateCell> rest = cells.subList(i + 1, cells.size());
                cell.setChildren(nestFlatChildren(new ArrayList<>(rest)));
                result.add(cell);
                return result;
            }
            if (cell.getChildren() != null) {
                cell.setChildren(nestFlatChildren(cell.getChildren()));
            }
            result.add(cell);
        }
        return result;
    }
}
