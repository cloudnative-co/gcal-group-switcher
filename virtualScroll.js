/**
 * 仮想スクロール実装
 * 大量のグループがある場合のパフォーマンスを最適化
 */

class VirtualScroll {
  constructor(options = {}) {
    this.itemHeight = options.itemHeight || 80; // 各グループアイテムの高さ（推定）
    this.containerHeight = options.containerHeight || 400; // コンテナの高さ
    this.buffer = options.buffer || 5; // バッファ（表示領域外に余分に描画するアイテム数）
    this.items = [];
    this.scrollTop = 0;
    this.visibleStart = 0;
    this.visibleEnd = 0;
  }

  /**
   * アイテムリストを設定
   */
  setItems(items) {
    this.items = items;
    this.calculateVisibleRange();
  }

  /**
   * スクロール位置を更新
   */
  setScrollTop(scrollTop) {
    this.scrollTop = scrollTop;
    this.calculateVisibleRange();
  }

  /**
   * コンテナの高さを更新
   */
  setContainerHeight(height) {
    this.containerHeight = height;
    this.calculateVisibleRange();
  }

  /**
   * 表示範囲を計算
   */
  calculateVisibleRange() {
    const visibleItemCount = Math.ceil(this.containerHeight / this.itemHeight);
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    
    this.visibleStart = Math.max(0, startIndex - this.buffer);
    this.visibleEnd = Math.min(
      this.items.length,
      startIndex + visibleItemCount + this.buffer
    );
  }

  /**
   * 表示すべきアイテムを取得
   */
  getVisibleItems() {
    return this.items.slice(this.visibleStart, this.visibleEnd);
  }

  /**
   * 表示範囲のインデックスを取得
   */
  getVisibleRange() {
    return {
      start: this.visibleStart,
      end: this.visibleEnd
    };
  }

  /**
   * 全体の高さを取得（スクロールバーの高さ計算用）
   */
  getTotalHeight() {
    return this.items.length * this.itemHeight;
  }

  /**
   * オフセットを取得（表示位置の調整用）
   */
  getOffset() {
    return this.visibleStart * this.itemHeight;
  }

  /**
   * 特定のアイテムが表示範囲内かチェック
   */
  isItemVisible(index) {
    return index >= this.visibleStart && index < this.visibleEnd;
  }

  /**
   * 特定のアイテムまでスクロールする位置を計算
   */
  getScrollPositionForItem(index) {
    return index * this.itemHeight;
  }
}

// Chrome拡張機能での使用のため
if (typeof window !== 'undefined') {
  window.VirtualScroll = VirtualScroll;
}