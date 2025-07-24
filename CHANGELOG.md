# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2025-07-24

### Added
- グループ設定のバックアップ・復元機能
  - 設定をJSONファイルとしてエクスポート
  - JSONファイルから設定をインポート
  - 拡張機能の再インストール時に設定を保持可能

## [1.0.0] - 2025-07-24

### Added
- Google Calendar グループスイッチャー Chrome拡張機能
- カレンダー表示のグループ管理機能
  - カレンダーグループの作成、編集、削除
  - 複数のカレンダーを1つのグループとして保存
  - ワンクリックでグループを適用し、カレンダーの表示/非表示を切り替え
- ドラッグ＆ドロップによるグループの並び替えインターフェース
- カレンダー名のオートコンプリート機能
- 「自分のカレンダーのみ表示」クイックアクションボタン
- メンバー表示のためのグループ展開/折りたたみ機能
- トラブルシューティング用のデバッグ情報表示
- 永続的データ保存のためのChrome storage API統合
- ポップアップとコンテンツスクリプト間のメッセージパッシング
- Google Calendarのチェックボックスベースのカレンダー選択に対応
- Vanilla JavaScript で構築（フレームワークの依存関係なし）
- Chrome Extension Manifest V3 を使用
- DOM操作のためのコンテンツスクリプトを実装
- タブ監視用のバックグラウンドサービスワーカー
- Chrome messaging API による非同期通信