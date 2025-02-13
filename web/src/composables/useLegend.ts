import * as d3 from "d3";
import { ComputedRef, computed, unref } from "@vue/composition-api";
import { MaybeRef } from "@/util/Types";
import { File, ObjMap } from "@/api/models";
import { useFileStore } from "@/api/stores";

export type Legend = {
  [key: string]: { label: string; selected: boolean; color: string };
};

/**
 * Create a legend for the given files.
 */
export function useLegend(files: MaybeRef<ObjMap<File> | null | undefined>): ComputedRef<Legend> {
  const fileStore = useFileStore();

  return computed((): Legend => {
    // Labels for the given files.
    const labels = new Set<string>();
    for (const file of Object.values(unref(files) ?? [])) {
      labels.add(file.extra.labels || "N/A");
    }

    // Labels for all the available files.
    const allLabels = new Set<string>();
    for (const file of fileStore.filesList) {
      allLabels.add(file.extra.labels || "N/A");
    }

    const colorScale = d3
      .scaleOrdinal(d3.schemeCategory10.filter((c) => c !== "#7f7f7f"))
      .domain([...allLabels].reverse());

    const legend = [...labels].sort().map((p) => ({
      label: p,
      selected: true,
      color: colorScale(p),
    }));

    return Object.fromEntries(legend.map((l) => [l.label, l]));
  });
}
