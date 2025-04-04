
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import _ from "lodash";

function permute(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const remainingPerms = permute(remaining);
    for (const perm of remainingPerms) {
      result.push([current, ...perm]);
    }
  }
  return result;
}

function getAllValidPartitionsWithPruning(items, maxWeight, calcCost, currentBestCost) {
  const results = [];

  function isValid(partition) {
    return partition.every(group => group.reduce((s, item) => s + item.weight, 0) <= maxWeight);
  }

  function getPartitionCost(partition) {
    return partition.reduce((sum, pkg) => sum + calcCost(pkg).cost, 0);
  }

  function generatePartition(arr, path = []) {
    if (arr.length === 0) {
      if (isValid(path)) {
        const cost = getPartitionCost(path);
        if (cost < currentBestCost.current) {
          currentBestCost.current = cost;
          results.push(path);
        }
      }
      return;
    }
    for (let i = 1; i <= arr.length; i++) {
      const head = arr.slice(0, i);
      const tail = arr.slice(i);
      const testPath = [...path, head];
      if (!isValid(testPath)) continue;
      const costSoFar = getPartitionCost(testPath);
      if (costSoFar >= currentBestCost.current) continue; // 剪枝
      generatePartition(tail, testPath);
    }
  }

  const allPermutations = permute(items);
  const bestCostRef = { current: Infinity };
  for (const perm of allPermutations) {
    generatePartition(perm);
  }
  return results;
}

function greedyPartition(items, maxWeight) {
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  const bins = [];
  for (const item of sorted) {
    let placed = false;
    for (const bin of bins) {
      const weight = bin.reduce((sum, i) => sum + i.weight, 0);
      if (weight + item.weight <= maxWeight) {
        bin.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) bins.push([item]);
  }
  return bins;
}

export default function App() {
  const [items, setItems] = useState([
    { name: "A", weight: 0 },
    { name: "B", weight: 0 },
    { name: "C", weight: 0 },
    { name: "D", weight: 0 },
    { name: "E", weight: 0 },
  ]);
  const [result, setResult] = useState(null);
  const [maxWeight, setMaxWeight] = useState(5);
  const [unitCost, setUnitCost] = useState(225);
  const [deliveryFee, setDeliveryFee] = useState(80);
  const [minDeliveryWeight, setMinDeliveryWeight] = useState(4);
  const [mode, setMode] = useState("optimal");
  const [timeTaken, setTimeTaken] = useState(null);

  const handleWeightChange = (index, newWeight) => {
    const updated = [...items];
    updated[index].weight = parseFloat(newWeight);
    setItems(updated);
  };

  const handleNameChange = (index, newName) => {
    const updated = [...items];
    updated[index].name = newName;
    setItems(updated);
  };

  const addItem = () => {
    const nextLetter = String.fromCharCode(65 + items.length);
    setItems([...items, { name: nextLetter, weight: 0 }]);
  };

  const removeItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const calcPackageCost = (packageItems) => {
    const totalWeight = packageItems.reduce((sum, item) => sum + item.weight, 0);
    const billableWeight = Math.ceil(totalWeight);
    let cost = billableWeight * unitCost;
    if (totalWeight < minDeliveryWeight) cost += deliveryFee;
    return { cost, billableWeight, totalWeight };
  };

  const optimize = () => {
    const start = performance.now();
    const groupings =
      mode === "optimal"
        ? getAllValidPartitionsWithPruning(items, maxWeight, calcPackageCost, { current: Infinity })
        : [greedyPartition(items, maxWeight)];

    let minCost = Infinity;
    let best = null;

    for (const grouping of groupings) {
      let totalCost = 0;
      const details = grouping.map(pkg => {
        const costInfo = calcPackageCost(pkg);
        totalCost += costInfo.cost;
        return { pkg, ...costInfo };
      });

      if (totalCost < minCost) {
        minCost = totalCost;
        best = details;
      }
    }

    const end = performance.now();
    setTimeTaken(((end - start) / 1000).toFixed(2));

    if (best) setResult({ cost: minCost, details: best });
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📦 自動拆包計算器</h1>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block mb-1 font-medium">每單最大重量（公斤）</label>
          <Input type="number" step="0.1" value={maxWeight} onChange={(e) => setMaxWeight(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div>
          <label className="block mb-1 font-medium">每公斤運費</label>
          <Input type="number" step="1" value={unitCost} onChange={(e) => setUnitCost(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div>
          <label className="block mb-1 font-medium">派送費（低於門檻）</label>
          <Input type="number" step="1" value={deliveryFee} onChange={(e) => setDeliveryFee(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div>
          <label className="block mb-1 font-medium">派送費門檻（公斤）</label>
          <Input type="number" step="0.1" value={minDeliveryWeight} onChange={(e) => setMinDeliveryWeight(parseFloat(e.target.value))} className="w-full" />
        </div>
      </div>

      <div className="mb-4">
        <label className="block mb-1 font-medium">運算模式</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="border rounded p-2 w-full">
          <option value="optimal">🔍 最佳模式（剪枝加速）</option>
          <option value="fast">⚡ 快速模式（近似最省）</option>
        </select>
      </div>

      {items.map((item, i) => (
        <div key={i} className="mb-2 flex gap-2 items-center">
          <Input type="text" value={item.name} onChange={(e) => handleNameChange(i, e.target.value)} className="w-12" />
          <Input type="number" step="0.01" value={item.weight} onChange={(e) => handleWeightChange(i, e.target.value)} className="w-24" />
          <span>kg</span>
          <Button variant="outline" size="sm" onClick={() => removeItem(i)}>刪除</Button>
        </div>
      ))}

      <Button className="mt-2 mr-2" onClick={addItem}>➕ 增加貨物</Button>
      <Button className="mt-2" onClick={optimize}>計算最省方案</Button>

      {result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
          <h2 className="text-xl font-semibold mb-2">✅ 最省運費：{result.cost} 元</h2>
          {timeTaken && <p className="text-sm text-gray-500 mb-4">計算時間：{timeTaken} 秒</p>}
          {result.details.map((detail, i) => (
            <Card key={i} className="mb-4">
              <CardContent className="p-4">
                <p className="font-medium">📦 包裹{i + 1}：</p>
                <ul className="list-disc list-inside">
                  {detail.pkg.map((item) => (
                    <li key={item.name}>{item.name}（{item.weight} kg）</li>
                  ))}
                </ul>
                <p className="mt-2">總重：{detail.totalWeight.toFixed(2)} kg</p>
                <p>計費重量：{detail.billableWeight} kg</p>
                <p>運費小計：{detail.cost} 元</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  );
}
