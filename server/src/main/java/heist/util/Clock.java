package heist.util;

/** Injected game clock. All game timing reads this, never System time directly. */
public interface Clock {
    long now();

    static Clock system() {
        return System::currentTimeMillis;
    }

    /** Game time runs {@code scale} times faster than wall time (used by the smoke test). */
    static Clock scaled(double scale) {
        long start = System.currentTimeMillis();
        long nano0 = System.nanoTime();
        return () -> start + (long) ((System.nanoTime() - nano0) / 1_000_000.0 * scale);
    }

    /** A clock moved by hand, for unit tests. */
    final class Manual implements Clock {
        private long t;

        public Manual(long start) {
            this.t = start;
        }

        @Override
        public long now() {
            return t;
        }

        public void advance(long ms) {
            t += ms;
        }

        public void set(long ms) {
            t = ms;
        }
    }
}
