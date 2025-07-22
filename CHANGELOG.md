# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-01-22

### Added
- 包括的なエラーハンドリングシステム
- パフォーマンス最適化（仮想スクロール、イベントデリゲーション）
- モジュラーアーキテクチャへのコード構造改善
- 単体テスト（Jest）とE2Eテスト（Playwright）
- CI/CDパイプライン（GitHub Actions）
- ESLintとPrettierによるコード品質管理
- セキュリティスキャン（CodeQL）
- 依存関係の自動更新（Dependabot）

### Changed
- popup.jsを複数のモジュールに分割（groupManager.js、calendarService.js、uiManager.js）
- エラーメッセージをユーザーフレンドリーに改善
- DOM操作のパフォーマンスを最適化

### Fixed
- メモリリークの可能性がある箇所を修正
- エラー発生時の適切なリカバリー処理を追加

## [1.1.0] - 2024-12-XX

### Added
- グループの編集機能
- ドラッグ＆ドロップによる並び替え機能
- グループの展開/折りたたみ機能
- GitHubリンクをヘッダーに追加

### Changed
- UIの改善（よりコンパクトなデザイン）

## [1.0.4] - 2024-XX-XX

### Added
- グループの並び替え機能（矢印ボタン）

## [1.0.3] - 2024-XX-XX

### Added
- 「自分のカレンダーのみ表示」機能

## [1.0.2] - 2024-XX-XX

### Added
- バックグラウンドサービスワーカー

### Fixed
- ポップアップの安定性向上

## [1.0.0] - 2024-XX-XX

### Added
- 初回リリース
- カレンダーグループの作成・保存機能
- ワンクリックでのグループ切り替え機能
- グループの削除機能
- オートコンプリート機能