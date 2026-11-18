# Publish `@effectumcore/effectum` (align npm with this repo)

Always publish from **`C:\Users\Heather\Documents\GitHub\Effectum`** (not Effectum-Pro).

**npm user:** `effectumcore0.1` is fine if you are a **collaborator** on the package or can publish to org **`effectumcore`**.

## 1. Clear mistaken deprecation (once)

If the npm page says the package moved to `@effectum/effectum`, remove that message (target package does not exist):

```powershell
npm deprecate @effectumcore/effectum@0.1.0 ""
npm deprecate @effectumcore/effectum@0.1.1 ""
```

Add `--otp=123456` if 2FA prompts.

## 2. Verify identity

```powershell
cd C:\Users\Heather\Documents\GitHub\Effectum
npm whoami
npm view @effectumcore/effectum version
```

## 3. Test, then publish

```powershell
npm test
npm publish --access public
```

Use `--otp=...` when publishing if required.

## 4. Verify

```powershell
npm view @effectumcore/effectum version
```

Open https://www.npmjs.com/package/@effectumcore/effectum — README should match this repo (GitHub funnel → **effectum-pro.com**), no red deprecation banner.

## 5. Commit version bump on GitHub

After a successful publish, commit `package.json` / `package-lock.json` version on `main` (via PR if branch is protected).