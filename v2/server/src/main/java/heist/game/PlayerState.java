package heist.game;

import java.util.ArrayList;
import java.util.List;

/** Everything the server knows about one player. Mutated only by GameEngine under the room lock. */
public final class PlayerState {
    public final String id;
    public final String name;
    public final int joinOrder;
    public final boolean bot;

    public boolean connected = true;
    public long disconnectedAt = -1;

    // Money (BE-05). Wallet is at risk, stash is safe.
    public long wallet;
    public long stash;

    // Physical bridge
    public String keyCode;
    public int vaultNo;
    public String vaultName;
    public boolean keyStolen;
    public String keyHeldBy;

    // Per round
    public String target;
    public long roundEarnings;
    public Attempt attempt;
    public long nextAssignAt = -1;
    public List<ModifierSpec> activeModifiers = new ArrayList<>();
    public final List<ModifierSpec> pendingModifiers = new ArrayList<>();
    public boolean sabotageUsed;
    public int cardsPlayed;
    public long jammedUntil = -1;

    // Card effects
    public boolean shield;
    public double stealBoost;

    // Teams (TM-01)
    public String team;

    // Lifetime stats
    public int successes;
    public int fails;
    public int steals;
    public long stolenAmount;
    public int timesRobbed;
    public long lostToThieves;
    public int freezeViolations;
    public int bounties;
    public long bestStreak;
    public long streak;
    public long peakWallet;

    // Endgame
    public boolean escaped;
    public long escapedAt = -1;
    public long lostAtEnd;

    public PlayerState(String id, String name, int joinOrder, boolean bot) {
        this.id = id;
        this.name = name;
        this.joinOrder = joinOrder;
        this.bot = bot;
    }

    public void credit(long amount) {
        wallet += amount;
        if (wallet > peakWallet) peakWallet = wallet;
    }

    /** Remove up to {@code amount} from the wallet; returns what was actually taken. */
    public long debit(long amount) {
        long taken = Math.max(0, Math.min(amount, wallet));
        wallet -= taken;
        return taken;
    }
}
