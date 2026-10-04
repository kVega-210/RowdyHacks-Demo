# Domain shortlist (IF-02)

> Prepared, needs a human: confirm which TLDs qualify under the GoDaddy Registry challenge rules, check
> availability, register, point an A record at the Vultr VM, then set `PUBLIC_URL` and the Caddy domain.

1. heisthavoc.xyz  2. heisthavoc.club  3. vaultcrew.fun  4. grabthecash.xyz  5. stickyfingers.club
6. thebigheist.fun  7. crackthevault.xyz  8. pocketheist.club  9. keyheist.xyz  10. escaperich.fun
11. robthebank.club  12. mastermind.party  13. heistnight.xyz  14. lootandscoot.fun  15. freezesteal.xyz

After registering: `A @ -> <vm ip>`, wait for DNS, `DOMAIN=<name> HOST=root@<ip> ./deploy/deploy.sh`, open
`https://<name>/health`, then join from a phone on cellular.
