package heist.game;

/**
 * MG-18 Hacker vs. Hacker: a special round where one random player gets the Scramble power against one
 * victim. Each scramble pushes the Jam the Signal modifier (MG-41) to the victim; every victim fail
 * while jammed pays the hacker a bonus.
 */
public final class HackerVsHacker {
    public final String hacker;
    public final String victim;
    public int usesLeft;

    public HackerVsHacker(String hacker, String victim, int uses) {
        this.hacker = hacker;
        this.victim = victim;
        this.usesLeft = uses;
    }

    public boolean use(String who) {
        if (!hacker.equals(who) || usesLeft <= 0) return false;
        usesLeft--;
        return true;
    }
}
