import * as d3 from "d3";
import { defineStore } from "pinia";
import { shallowRef, computed } from "@vue/composition-api";
import { DATA_URL } from "@/api";
import { assertType, fileToTokenizedFile } from "@/api/utils";
import {
  useFileStore,
  useKgramStore,
  useMetadataStore,
  useSemanticStore,
} from "@/api/stores";
import {
  Pair,
  ObjMap,
  File,
  Hash,
  Kgram,
  Fragment,
  PairedOccurrence,
} from "@/api/models";
import {
  Fragment as DolosFragment,
  EmptyTokenizer,
  Options,
  Index,
  SemanticAnalyzer,
} from "@dodona/dolos-lib";

/**
 * Store containing the pair data & helper functions.
 */
export const usePairStore = defineStore("pairs", () => {
  // List of pairs.
  const pairs = shallowRef<ObjMap<Pair>>({});
  const pairsList = computed<Pair[]>(() => Object.values(pairs.value));

  // If this store has been hydrated.
  const hydrated = shallowRef(false);

  // Parse the pairs from a CSV string.
  function parse(pairData: d3.DSVRowArray, files: ObjMap<File>): ObjMap<Pair> {
    return Object.fromEntries(
      pairData.map((row) => {
        const id = parseInt(assertType(row.id));
        const similarity = parseFloat(assertType(row.similarity));
        const longestFragment = parseFloat(assertType(row.longestFragment));
        const totalOverlap = parseFloat(assertType(row.totalOverlap));
        const leftCovered = parseFloat(assertType(row.leftCovered));
        const rightCovered = parseFloat(assertType(row.rightCovered));

        const diff = {
          id,
          similarity,
          longestFragment,
          totalOverlap,
          leftFile: files[parseInt(assertType(row.leftFileId))],
          rightFile: files[parseInt(assertType(row.rightFileId))],
          fragments: null,
          pairedMatches: [],
          unpairedMatches: [],
          leftCovered,
          rightCovered,
        };
        return [id, diff];
      })
    );
  }

  // Fetch the pairs from the CSV file.
  async function fetch(
    url: string = DATA_URL + "pairs.csv"
  ): Promise<d3.DSVRowArray> {
    return await d3.csv(url);
  }

  // Reference to the other stores.
  const fileStore = useFileStore();
  const kgramStore = useKgramStore();
  const metadataStore = useMetadataStore();
  const semanticStore = useSemanticStore();

  // Hydrate the store
  async function hydrate(): Promise<void> {
    // Make sure the file store is hydrated.
    if (!fileStore.hydrated) {
      throw new Error("The file store must be hydrated before the pair store.");
    }

    pairs.value = parse(await fetch(), fileStore.files);
    hydrated.value = true;
  }

  // Parse a list of Dolos fragments into a list of fragment models.
  function parseFragments(
    dolosFragments: DolosFragment[],
    kmersMap: Map<Hash, Kgram>
  ): Fragment[] {
    // const parsed = JSON.parse(fragmentsJson);
    return dolosFragments.map((dolosFragment: DolosFragment): Fragment => {
      return {
        active: true,
        left: dolosFragment.leftSelection,
        right: dolosFragment.rightSelection,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        data: dolosFragment.mergedData!,
        occurrences: dolosFragment.pairs.map((occurrence): PairedOccurrence => {
          return {
            kgram: assertType(kmersMap.get(occurrence.fingerprint.hash)),
            left: occurrence.left,
            right: occurrence.right,
          };
        }),
      };
    });
  }

  // Populate the fragments for a given pair.
  async function populateFragments(pair: Pair): Promise<void> {
    const customOptions = metadataStore.metadata;
    const kmers = kgramStore.kgrams;

    const emptyTokenizer = new EmptyTokenizer();
    const options = new Options(customOptions);
    const index = new Index(emptyTokenizer, options);
    const leftFile = fileToTokenizedFile(pair.leftFile);
    const rightFile = fileToTokenizedFile(pair.rightFile);
    const report = await index.compareTokenizedFiles([leftFile, rightFile]);
    const reportPair = report.scoredPairs[0].pair;

    if (pair.leftFile.semanticMap && pair.rightFile.semanticMap) {
      const [pairedMatches, unpairedMatches] = SemanticAnalyzer.pairMatches(
        leftFile,
        rightFile,
        pair.leftFile.semanticMap.filter(
          (f) => +f.right === +pair.rightFile.id
        ),
        pair.rightFile.semanticMap.filter(
          (f) => +f.right === +pair.leftFile.id
        ),
        semanticStore.occurrences
      );

      pair.pairedMatches = pairedMatches;
      pair.unpairedMatches = unpairedMatches;
    }

    const kmersMap: Map<Hash, Kgram> = new Map();
    for (const kmerKey in kmers) {
      const kmer = kmers[kmerKey];
      kmersMap.set(kmer.hash, kmer);
    }
    pair.fragments = parseFragments(reportPair.fragments(), kmersMap);
  }

  // Populate the semantic matches for a given pair.
  async function populateSemantic(pair: Pair): Promise<void> {
    const leftFile = fileToTokenizedFile(pair.leftFile);
    const rightFile = fileToTokenizedFile(pair.rightFile);
    if (!pair.leftFile.semanticMap || !pair.rightFile.semanticMap) return;

    const [pairedMatches, unpairedMatches] = SemanticAnalyzer.pairMatches(
      leftFile,
      rightFile,
      pair.leftFile.semanticMap,
      pair.rightFile.semanticMap,
      semanticStore.occurrences
    );

    pair.pairedMatches = pairedMatches;
    pair.unpairedMatches = unpairedMatches;
  }

  // Get a pair by its ID.
  function getPair(id: number): Pair {
    return pairs.value[id];
  }

  return {
    pairs,
    pairsList,
    hydrated,
    hydrate,
    populateFragments,
    populateSemantic,
    getPair,
  };
});
