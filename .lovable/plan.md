Adrese potvrđene:
- TemplateRegistry: `0xBf55f8413DFf2Aeb136c6d385BB7caE2d1080FAc`
- CredentialRegistry: `0x082aBf0423d43E4286bC61151E34377e1Bc69596`

Kad odobriš plan, izvršiću sledeće redosledom:

1. **Bundle ABI fajlova** — `src/lib/chain/abi/CredentialRegistry.json` i `TemplateRegistry.json` (sa GitHub repoa). Skidam ABI parsiranje iz env-a.

2. **Prepisati `src/lib/chain/bloxberg.server.ts`** da odgovara stvarnim potpisima:
   - `registerTemplateVersion(templateRef, templateIdHash, documentHash, version:uint32, issuerNameSnapshot)`
   - `issueCredential(credentialId, documentHash, learnerCommitment, templateRef, expiresAt, issuerNameSnapshot)`
   - `revokeCredential(credentialId, reasonHash)`
   - `getChainAvailability()` dodatno proverava da issuer wallet ima `ISSUER_ROLE` na oba ugovora.

3. **Migracija**: dodati `credentials.recovery_secret bytea` (samo `service_role` čita/piše; RLS deny svima) za off-chain re-derivaciju `learnerCommitment`.

4. **Update `anchor.functions.ts` + `worker.server.ts`**: pri izdavanju generisati 32B `recovery_secret`, izračunati `learnerCommitment = keccak256(credentialId ‖ learnerIdHash ‖ recoverySecret)`, sačuvati i anchor-ovati. Za template-e koristiti integer `version`.

5. **Dodati 3 secrets** preko forme (ti unosiš vrednosti):
   - `BLOXBERG_PRIVATE_KEY` (0x… 64 hex)
   - `TEMPLATE_REGISTRY_ADDRESS` = `0xBf55…0FAc`
   - `CREDENTIAL_REGISTRY_ADDRESS` = `0x082a…9596`

6. **Issuer dashboard "Blockchain" widget**: prikazuje status iz `getChainAvailability` (ok / missing_config / rpc_unavailable / insufficient_balance / missing_role), wallet address, balance, linkove na block explorer za oba registar contracta.

7. **Smoke test**: anchor-ovati 1 postojeći template i izdati 1 credential, proveriti tx na block exploreru.

**Napomena o `ISSUER_ROLE`**: tvoj issuer wallet MORA već imati `ISSUER_ROLE` granted na oba ugovora (od strane admin wallet-a koji je deployovao). Ako nema, sve transakcije će revert-ovati sa `AccessControlUnauthorizedAccount`. Health check iz koraka 2 će to odmah prijaviti.