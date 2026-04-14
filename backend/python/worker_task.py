#!/usr/bin/env python3
import csv
import json
import math
import os
import random
import sys
from typing import List, Tuple


def sigmoid(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def load_csv_dataset(file_path: str) -> Tuple[List[List[float]], List[float]]:
    features: List[List[float]] = []
    labels: List[float] = []
    with open(file_path, "r", newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row:
                continue
            values = [float(v) for v in row]
            if len(values) < 2:
                continue
            features.append(values[:-1])
            labels.append(values[-1])
    return features, labels


def load_sklearn_dataset(dataset_name: str, operation: str) -> Tuple[List[List[float]], List[float]]:
    try:
        from sklearn.datasets import (  # type: ignore
            load_breast_cancer,
            load_diabetes,
            load_iris,
            load_wine,
        )
    except Exception as exc:  # pragma: no cover - depends on runtime env
        raise RuntimeError(
            "Dataset preset requires scikit-learn. Install with: pip install -r backend/python/requirements.txt"
        ) from exc

    key = dataset_name.split(":", 1)[1].strip().lower() if ":" in dataset_name else dataset_name.strip().lower()
    loaders = {
        "iris": load_iris,
        "wine": load_wine,
        "breast-cancer": load_breast_cancer,
        "breast_cancer": load_breast_cancer,
        "diabetes": load_diabetes,
    }

    if key not in loaders:
        raise RuntimeError(
            f"Unknown real dataset preset '{dataset_name}'. Use one of: sklearn:iris, sklearn:wine, sklearn:breast-cancer, sklearn:diabetes"
        )

    bundle = loaders[key]()
    raw_x = bundle.data
    raw_y = bundle.target

    features = [[float(value) for value in row] for row in raw_x.tolist()]
    labels_raw = [float(value) for value in raw_y.tolist()]

    if operation == "regression":
        return features, labels_raw

    unique = sorted(set(labels_raw))
    if len(unique) <= 2:
        positive = unique[-1]
        labels = [1.0 if value == positive else 0.0 for value in labels_raw]
        return features, labels

    pivot = unique[len(unique) // 2]
    labels = [1.0 if value >= pivot else 0.0 for value in labels_raw]
    return features, labels


def scale_dataset(
    features: List[List[float]],
    labels: List[float],
    target_samples: int,
    target_features: int,
    seed: int,
) -> Tuple[List[List[float]], List[float]]:
    if not features:
        return features, labels

    rng = random.Random(seed)
    base_rows = len(features)

    scaled_x = [row[:] for row in features]
    scaled_y = labels[:]

    if target_samples > len(scaled_x):
        while len(scaled_x) < target_samples:
            src_idx = len(scaled_x) % base_rows
            src_row = features[src_idx]
            jittered = [value + rng.uniform(-0.01, 0.01) for value in src_row]
            scaled_x.append(jittered)
            scaled_y.append(labels[src_idx])
    elif target_samples < len(scaled_x):
        indices = list(range(len(scaled_x)))
        rng.shuffle(indices)
        keep = sorted(indices[:target_samples])
        scaled_x = [scaled_x[i] for i in keep]
        scaled_y = [scaled_y[i] for i in keep]

    current_features = len(scaled_x[0])
    if target_features > current_features:
        for row in scaled_x:
            base = row[:]
            i = 0
            while len(row) < target_features:
                a = base[i % len(base)]
                b = base[(i + 1) % len(base)]
                row.append((a * b) + math.sin(a) + ((i % 5) * 0.01))
                i += 1
    elif target_features < current_features:
        scaled_x = [row[:target_features] for row in scaled_x]

    return scaled_x, scaled_y


def generate_synthetic(total: int, seed: int) -> Tuple[List[List[float]], List[float]]:
    rng = random.Random(seed)
    features: List[List[float]] = []
    labels: List[float] = []

    for _ in range(total):
        x1 = rng.uniform(-2.0, 2.0)
        x2 = rng.uniform(-2.0, 2.0)
        linear = 1.8 * x1 - 1.2 * x2 + 0.4
        prob = sigmoid(linear)
        y = 1.0 if rng.random() < prob else 0.0
        features.append([x1, x2])
        labels.append(y)

    return features, labels


def generate_synthetic_profile(profile: str, total: int, feature_count: int, seed: int, operation: str) -> Tuple[List[List[float]], List[float]]:
    rng = random.Random(seed)
    features: List[List[float]] = []
    labels: List[float] = []

    use_nonlinear = profile in {"nonlinear", "nl-heavy", "wide-heavy"}
    noise_scale = 0.22 if profile in {"noisy", "nl-heavy"} else 0.1

    for _ in range(total):
        row = [rng.uniform(-2.5, 2.5) for _ in range(max(2, feature_count))]

        linear = 0.0
        for i, value in enumerate(row):
            coef = (1.8 / (i + 1)) if i % 2 == 0 else (-1.2 / (i + 1))
            linear += coef * value

        if use_nonlinear:
            linear += 0.6 * (row[0] ** 2) - 0.4 * math.sin(row[1])

        linear += rng.uniform(-noise_scale, noise_scale)

        if operation == "regression":
            y = linear
        else:
            prob = sigmoid(linear)
            y = 1.0 if rng.random() < prob else 0.0

        features.append(row)
        labels.append(y)

    return features, labels


def shard_slice(features: List[List[float]], labels: List[float], shard_index: int, total_shards: int) -> Tuple[List[List[float]], List[float]]:
    shard_x: List[List[float]] = []
    shard_y: List[float] = []

    for idx, row in enumerate(features):
        if idx % total_shards == (shard_index - 1):
            shard_x.append(row)
            shard_y.append(labels[idx])

    if not shard_x:
        # Keep at least one sample so the worker can progress.
        shard_x = features[:1]
        shard_y = labels[:1]

    return shard_x, shard_y


def train_logistic(features: List[List[float]], labels: List[float], epochs: int, learning_rate: float) -> dict:
    dims = len(features[0])
    weights = [0.0] * dims
    bias = 0.0

    for _ in range(max(1, epochs)):
        dw = [0.0] * dims
        db = 0.0

        for x, y in zip(features, labels):
            z = sum(w * xi for w, xi in zip(weights, x)) + bias
            p = sigmoid(z)
            diff = p - y

            for i in range(dims):
                dw[i] += diff * x[i]
            db += diff

        scale = 1.0 / len(features)
        for i in range(dims):
            weights[i] -= learning_rate * dw[i] * scale
        bias -= learning_rate * db * scale

    loss = 0.0
    correct = 0
    for x, y in zip(features, labels):
        z = sum(w * xi for w, xi in zip(weights, x)) + bias
        p = sigmoid(z)
        p = min(max(p, 1e-9), 1.0 - 1e-9)
        loss += -(y * math.log(p) + (1.0 - y) * math.log(1.0 - p))
        pred = 1.0 if p >= 0.5 else 0.0
        if pred == y:
            correct += 1

    return {
        "loss": loss / len(features),
        "accuracy": correct / len(features),
        "weights": [round(w, 6) for w in weights],
        "bias": round(bias, 6)
    }


def train_linear(features: List[List[float]], labels: List[float], epochs: int, learning_rate: float) -> dict:
    dims = len(features[0])
    weights = [0.0] * dims
    bias = 0.0

    for _ in range(max(1, epochs)):
        dw = [0.0] * dims
        db = 0.0

        for x, y in zip(features, labels):
            pred = sum(w * xi for w, xi in zip(weights, x)) + bias
            diff = pred - y

            for i in range(dims):
                dw[i] += diff * x[i]
            db += diff

        scale = 1.0 / len(features)
        for i in range(dims):
            weights[i] -= learning_rate * dw[i] * scale
        bias -= learning_rate * db * scale

    mse = 0.0
    correct = 0
    for x, y in zip(features, labels):
        pred = sum(w * xi for w, xi in zip(weights, x)) + bias
        mse += (pred - y) ** 2

        # Convert to pseudo-classification score for UI consistency.
        pred_cls = 1.0 if pred >= 0.5 else 0.0
        y_cls = 1.0 if y >= 0.5 else 0.0
        if pred_cls == y_cls:
            correct += 1

    return {
        "loss": mse / len(features),
        "accuracy": correct / len(features),
        "weights": [round(w, 6) for w in weights],
        "bias": round(bias, 6)
    }


def main() -> int:
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No task payload provided"}))
        return 1

    task = json.loads(raw)
    payload = task.get("payload", {})

    dataset = payload.get("dataset", "synthetic.csv")
    operation = str(payload.get("operation", "classification")).strip().lower()
    dataset_profile = str(payload.get("datasetProfile", "auto")).strip().lower()
    model = str(payload.get("model", "logistic-regression")).strip().lower()
    epochs = int(payload.get("epochs", 3))
    learning_rate = float(payload.get("learningRate", 0.1))
    sample_count = int(payload.get("sampleCount", 600))
    feature_count = int(payload.get("featureCount", 2))
    compute_multiplier = int(payload.get("computeMultiplier", 1))
    total_shards = int(payload.get("totalShards", 1))
    shard_index = int(payload.get("shardIndex", task.get("shard", 1)))

    sample_count = max(200, min(300000, sample_count))
    feature_count = max(2, min(128, feature_count))
    compute_multiplier = max(1, min(20, compute_multiplier))
    workload_seed = abs(hash(f"{dataset}-{sample_count}-{feature_count}-{total_shards}")) % (2 ** 31)

    dataset_path = dataset if os.path.isabs(dataset) else os.path.join(os.getcwd(), dataset)

    try:
        if dataset.lower().startswith("sklearn:"):
            x, y = load_sklearn_dataset(dataset, operation)
        elif os.path.exists(dataset_path):
            x, y = load_csv_dataset(dataset_path)
        else:
            seed = abs(hash(f"{dataset}-{total_shards}-{shard_index}")) % (2 ** 31)
            if dataset_profile == "auto":
                x, y = generate_synthetic(sample_count, seed)
            else:
                x, y = generate_synthetic_profile(dataset_profile, sample_count, feature_count, seed, operation)
    except RuntimeError as err:
        print(json.dumps({"error": str(err)}))
        return 1

    x, y = scale_dataset(x, y, sample_count, feature_count, workload_seed)

    if not x:
        print(json.dumps({"error": "Dataset is empty"}))
        return 1

    shard_x, shard_y = shard_slice(x, y, shard_index, max(1, total_shards))

    effective_epochs = max(1, epochs * compute_multiplier)

    chosen_model = model
    if operation == "regression" and model == "logistic-regression":
        chosen_model = "linear-regression"
    if operation == "classification" and model == "linear-regression":
        chosen_model = "logistic-regression"

    if chosen_model == "linear-regression":
        result = train_linear(shard_x, shard_y, effective_epochs, learning_rate)
    else:
        result = train_logistic(shard_x, shard_y, effective_epochs, learning_rate)

    result["records"] = len(shard_x)
    result["actualSampleCount"] = len(x)
    result["actualFeatureCount"] = len(x[0]) if x else 0
    result["model"] = chosen_model
    result["operation"] = operation
    result["datasetProfile"] = dataset_profile
    result["dataset"] = dataset
    result["epochs"] = effective_epochs
    result["shard"] = shard_index
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
