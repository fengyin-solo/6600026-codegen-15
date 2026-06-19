<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue';
import type { PhyloNode } from '../types';

const props = defineProps<{
  tree: PhyloNode | null;
  selectedNames?: string[];
}>();

const emit = defineEmits<{
  (e: 'node-click', name: string): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

interface LeafPosition {
  name: string;
  x: number;
  y: number;
  labelWidth: number;
  hitAreaX: number;
  hitAreaWidth: number;
}

const leafPositions = ref<LeafPosition[]>([]);

const selectedSet = computed(() => new Set(props.selectedNames || []));

function countLeaves(node: PhyloNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function getMaxDepth(node: PhyloNode, current = 0): number {
  if (node.children.length === 0) return current + node.branchLength;
  return Math.max(...node.children.map(c => getMaxDepth(c, current + node.branchLength)));
}

function drawTree() {
  const canvas = canvasRef.value;
  if (!canvas || !props.tree) return;

  const width = 500;
  const height = 400;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);

  const totalLeaves = countLeaves(props.tree);
  const maxDepth = getMaxDepth(props.tree) || 1;

  const leftMargin = 30;
  const rightMargin = 140;
  const topMargin = 30;
  const bottomMargin = 30;
  const treeWidth = width - leftMargin - rightMargin;
  const treeHeight = height - topMargin - bottomMargin;

  let leafIndex = 0;
  const xScale = treeWidth / maxDepth;
  const yStep = treeHeight / Math.max(totalLeaves - 1, 1);

  leafPositions.value = [];
  const positions: LeafPosition[] = [];

  function drawNode(node: PhyloNode, x: number, y: number): { x: number; y: number } {
    const nodeX = x + node.branchLength * xScale;

    if (node.children.length === 0) {
      const leafY = topMargin + leafIndex * yStep;
      leafIndex++;

      const isSelected = selectedSet.value.has(node.name);

      ctx.strokeStyle = isSelected ? '#f59e0b' : '#6ee7b7';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(x, leafY);
      ctx.lineTo(nodeX, leafY);
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#fbbf24' : '#d1d5db';
      ctx.font = isSelected ? 'bold 11px sans-serif' : '11px sans-serif';
      ctx.textAlign = 'left';
      const label = node.name.length > 20 ? node.name.substring(0, 18) + '...' : node.name;
      ctx.fillText(label, nodeX + 8, leafY + 4);

      const labelWidth = ctx.measureText(label).width;
      const hitAreaX = nodeX - 6;
      const hitAreaWidth = labelWidth + 20;

      if (isSelected) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
        ctx.fillRect(hitAreaX, leafY - 10, hitAreaWidth, 20);
      }

      ctx.fillStyle = isSelected ? '#f59e0b' : '#06b6d4';
      ctx.beginPath();
      ctx.arc(nodeX, leafY, isSelected ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();

      positions.push({
        name: node.name,
        x: nodeX,
        y: leafY,
        labelWidth,
        hitAreaX,
        hitAreaWidth
      });

      return { x: nodeX, y: leafY };
    }

    const childPositions = node.children.map(child => drawNode(child, nodeX, y));

    const minY = Math.min(...childPositions.map(p => p.y));
    const maxY = Math.max(...childPositions.map(p => p.y));
    const nodeY = (minY + maxY) / 2;

    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nodeX, minY);
    ctx.lineTo(nodeX, maxY);
    ctx.stroke();

    if (x > 0 || node.branchLength > 0) {
      ctx.beginPath();
      ctx.moveTo(x, nodeY);
      ctx.lineTo(nodeX, nodeY);
      ctx.stroke();
    }

    ctx.fillStyle = '#a78bfa';
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    return { x: nodeX, y: nodeY };
  }

  drawNode(props.tree, leftMargin, topMargin);
  leafPositions.value = positions;

  ctx.fillStyle = '#9ca3af';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('进化树 (Neighbor-Joining)', width / 2, 18);
}

function handleCanvasClick(event: MouseEvent) {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;

  for (const leaf of leafPositions.value) {
    const hitY = leaf.y - 10;
    const hitHeight = 20;

    if (
      clickX >= leaf.hitAreaX &&
      clickX <= leaf.hitAreaX + leaf.hitAreaWidth &&
      clickY >= hitY &&
      clickY <= hitY + hitHeight
    ) {
      emit('node-click', leaf.name);
      return;
    }

    const dotRadius = 8;
    const dx = clickX - leaf.x;
    const dy = clickY - leaf.y;
    if (dx * dx + dy * dy <= dotRadius * dotRadius) {
      emit('node-click', leaf.name);
      return;
    }
  }
}

onMounted(() => {
  drawTree();
});

watch(() => props.tree, () => {
  nextTick(() => drawTree());
}, { deep: true });

watch(() => props.selectedNames, () => {
  nextTick(() => drawTree());
}, { deep: true });
</script>

<template>
  <div class="bg-gray-900 rounded-lg overflow-hidden">
    <div class="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-300">系统发育树</h3>
      <span class="text-xs text-gray-500">Neighbor-Joining 法</span>
    </div>
    <div class="p-4 flex justify-center">
      <canvas
        v-if="tree"
        ref="canvasRef"
        width="500"
        height="400"
        class="border border-gray-700 rounded cursor-pointer"
        @click="handleCanvasClick"
      ></canvas>
      <div v-else class="flex items-center justify-center w-full h-64 text-gray-600 text-sm">
        请先加载序列并构建进化树
      </div>
    </div>
  </div>
</template>
