# Releases

Esta pasta contém os APKs de debug gerados pelo processo de build.

Os arquivos nesta pasta são rastreados pelo Git e serão commitados automaticamente após cada build bem-sucedido.

## Estrutura

- `BiluShape-v[X.Y.Z].apk` - APK de debug assinado com a versão correspondente

## Uso

Para gerar um novo APK e movê-lo para esta pasta:

```powershell
npm run android:build
```

Para fazer commit do APK gerado:

```powershell
npm run android:commit
```

Para build + commit em um único comando:

```powershell
npm run android:build-commit
```
