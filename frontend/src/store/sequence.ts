import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Sequence, AlignmentResult, GCContent, PhyloNode } from '../types';
import {
  needlemanWunsch,
  smithWaterman,
  calculateGCContent,
  calculateDistanceMatrix,
  buildNJTree,
  MOCK_SEQUENCES
} from '../utils/alignment';

export const useSequenceStore = defineStore('sequence', () => {
  const sequences = ref<Sequence[]>([]);
  const alignmentResult = ref<AlignmentResult | null>(null);
  const currentAlgorithm = ref<'nw' | 'sw'>('nw');
  const gcData = ref<GCContent[]>([]);
  const phyloTree = ref<PhyloNode | null>(null);
  const selectedSeq1 = ref<string>('');
  const selectedSeq2 = ref<string>('');
  const selectedTreeNodeNames = ref<string[]>([]);

  const alignmentIdentity = computed(() => {
    return alignmentResult.value ? alignmentResult.value.identity : 0;
  });

  const alignmentScore = computed(() => {
    return alignmentResult.value ? alignmentResult.value.score : 0;
  });

  function addSequence(id: string, name: string, data: string) {
    sequences.value.push({
      id,
      name,
      data: data.toUpperCase().replace(/[^ACGT]/g, ''),
      length: data.length
    });
  }

  function removeSequence(id: string) {
    sequences.value = sequences.value.filter(s => s.id !== id);
  }

  function runAlignment(seq1Id: string, seq2Id: string, algorithm: 'nw' | 'sw') {
    const s1 = sequences.value.find(s => s.id === seq1Id);
    const s2 = sequences.value.find(s => s.id === seq2Id);

    if (!s1 || !s2) return;

    currentAlgorithm.value = algorithm;

    if (algorithm === 'nw') {
      alignmentResult.value = needlemanWunsch(s1.data, s2.data);
    } else {
      alignmentResult.value = smithWaterman(s1.data, s2.data);
    }
  }

  function loadMockSequences() {
    sequences.value = [];
    for (const mock of MOCK_SEQUENCES) {
      addSequence(mock.id, mock.name, mock.data);
    }
    selectedSeq1.value = MOCK_SEQUENCES[0].id;
    selectedSeq2.value = MOCK_SEQUENCES[1].id;
  }

  function buildTree() {
    if (sequences.value.length < 2) return;

    const seqData = sequences.value.map(s => ({ name: s.name, data: s.data }));
    const distMatrix = calculateDistanceMatrix(seqData);
    const names = sequences.value.map(s => s.name);
    phyloTree.value = buildNJTree(distMatrix, names);
  }

  function analyzeGC(seqId: string, windowSize: number) {
    const seq = sequences.value.find(s => s.id === seqId);
    if (!seq) return;
    gcData.value = calculateGCContent(seq.data, windowSize);
  }

  function toggleTreeNodeSelection(name: string) {
    const idx = selectedTreeNodeNames.value.indexOf(name);
    if (idx > -1) {
      selectedTreeNodeNames.value.splice(idx, 1);
    } else {
      if (selectedTreeNodeNames.value.length >= 2) {
        selectedTreeNodeNames.value.shift();
      }
      selectedTreeNodeNames.value.push(name);
    }
  }

  function clearTreeNodeSelection() {
    selectedTreeNodeNames.value = [];
  }

  function getSeqIdByName(name: string): string | undefined {
    const seq = sequences.value.find(s => s.name === name);
    return seq?.id;
  }

  function quickAlignFromTree() {
    if (selectedTreeNodeNames.value.length !== 2) return;

    const id1 = getSeqIdByName(selectedTreeNodeNames.value[0]);
    const id2 = getSeqIdByName(selectedTreeNodeNames.value[1]);

    if (!id1 || !id2) return;

    selectedSeq1.value = id1;
    selectedSeq2.value = id2;
    runAlignment(id1, id2, currentAlgorithm.value);
  }

  return {
    sequences,
    alignmentResult,
    currentAlgorithm,
    gcData,
    phyloTree,
    selectedSeq1,
    selectedSeq2,
    selectedTreeNodeNames,
    alignmentIdentity,
    alignmentScore,
    addSequence,
    removeSequence,
    runAlignment,
    loadMockSequences,
    buildTree,
    analyzeGC,
    toggleTreeNodeSelection,
    clearTreeNodeSelection,
    quickAlignFromTree,
    getSeqIdByName
  };
});
