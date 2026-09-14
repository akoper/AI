# Quantum Computing Fundamentals & Breakthroughs

## What is a Qubit?
In classical computing, a bit can exist in a state of 0 or 1. In quantum computing, a quantum bit or **qubit** can exist in a linear combination (superposition) of $|0\rangle$ and $|1\rangle$:

$$|\psi\rangle = \alpha |0\rangle + \beta |1\rangle$$

where $\alpha$ and $\beta$ are complex numbers such that $|\alpha|^2 + |\beta|^2 = 1$.

## Quantum Entanglement
Quantum entanglement is a phenomenon where two or more qubits become interconnected such that the quantum state of one instantly dictates the state of another, regardless of the physical distance separating them. This property is vital for quantum teleportation and dense coding.

## Major Algorithms
1. **Shor's Algorithm (1994)**: Provides exponential speedup for integer factorization and computing discrete logarithms, threatening RSA and Elliptic Curve Cryptography.
2. **Grover's Algorithm (1996)**: Provides quadratic speedup for searching unsorted databases containing $N$ items in $O(\sqrt{N})$ time versus classical $O(N)$.
3. **Quantum Approximate Optimization Algorithm (QAOA)**: Designed for combinatorial optimization problems in the NISQ (Noisy Intermediate-Scale Quantum) era.

## Quantum Error Correction
Topological quantum error correction using Surface Codes requires hundreds to thousands of physical qubits to realize a single fault-tolerant logical qubit. Threshold fidelities for two-qubit gates must exceed 99.9% to achieve practical quantum advantage.
