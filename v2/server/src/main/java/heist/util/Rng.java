package heist.util;

import java.util.ArrayList;
import java.util.List;
import java.util.SplittableRandom;

/** Seeded RNG so games and tests are reproducible. */
public final class Rng {
    private final SplittableRandom r;

    public Rng(long seed) {
        this.r = new SplittableRandom(seed);
    }

    public int nextInt(int bound) {
        return r.nextInt(bound);
    }

    public int range(int minInclusive, int maxInclusive) {
        return minInclusive + r.nextInt(maxInclusive - minInclusive + 1);
    }

    public long range(long minInclusive, long maxInclusive) {
        if (maxInclusive <= minInclusive) return minInclusive;
        return minInclusive + r.nextLong(maxInclusive - minInclusive + 1);
    }

    public double nextDouble() {
        return r.nextDouble();
    }

    public boolean chance(double p) {
        return r.nextDouble() < p;
    }

    /** A positive 31-bit seed suitable for handing to clients. */
    public long seed() {
        return r.nextLong(1, 0x7fffffffL);
    }

    public <T> T pick(List<T> items) {
        return items.get(r.nextInt(items.size()));
    }

    public <T> List<T> shuffled(List<T> items) {
        List<T> out = new ArrayList<>(items);
        for (int i = out.size() - 1; i > 0; i--) {
            int j = r.nextInt(i + 1);
            T tmp = out.get(i);
            out.set(i, out.get(j));
            out.set(j, tmp);
        }
        return out;
    }
}
