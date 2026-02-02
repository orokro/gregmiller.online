export default class PRNG {
    constructor(seedStr) {
        this.seed = this.cyrb128(seedStr);
    }

    // Cypher hashing algorithm to generate a seed state from a string
    cyrb128(str) {
        let h1 = 1779033703, h2 = 3144134277,
            h3 = 1013904242, h4 = 2773480762;
        for (let i = 0, k; i < str.length; i++) {
            k = str.charCodeAt(i);
            h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
            h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
            h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
            h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
        }
        h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
        h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
        h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
        h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
        return [
            (h1 ^ h2 ^ h3 ^ h4) >>> 0,
            (h2 ^ h1) >>> 0,
            (h3 ^ h1) >>> 0,
            (h4 ^ h1) >>> 0
        ];
    }

    // Mulberry32 generator
    random() {
        let t = this.seed[0] += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // Helper to get random in range [min, max)
    range(min, max) {
        return min + this.random() * (max - min);
    }

    // Helper to pick random element from array
    pick(array) {
        if (!array || array.length === 0) return null;
        return array[Math.floor(this.random() * array.length)];
    }

    // Helper for odds (0.0 - 1.0)
    bool(odds = 0.5) {
        return this.random() < odds;
    }
}
