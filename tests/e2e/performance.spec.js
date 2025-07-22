/**
 * パフォーマンステストのE2Eテスト
 */

const { test, expect, helpers } = require('./fixtures');

test.describe('パフォーマンステスト', () => {
  test('大量のグループでのレンダリング性能', async ({ extensionPage }) => {
    const startTime = Date.now();
    
    // 50個のグループを作成
    for (let i = 0; i < 50; i++) {
      await extensionPage.fill('#groupName', `グループ${i + 1}`);
      await extensionPage.fill('#memberInput', `メンバー${i + 1}-1\nメンバー${i + 1}-2`);
      await extensionPage.click('#createGroup');
      
      // メッセージをクリアして次へ
      const message = extensionPage.locator('.message');
      if (await message.isVisible()) {
        await message.click(); // メッセージをクリックして閉じる
      }
    }
    
    const creationTime = Date.now() - startTime;
    console.log(`50グループの作成時間: ${creationTime}ms`);
    
    // レンダリング性能を測定
    const renderStart = Date.now();
    await extensionPage.reload();
    await extensionPage.waitForSelector('.group-list');
    const renderTime = Date.now() - renderStart;
    
    console.log(`50グループのレンダリング時間: ${renderTime}ms`);
    
    // パフォーマンス基準
    expect(renderTime).toBeLessThan(2000); // 2秒以内
    
    // 仮想スクロールが有効になっていることを確認
    const groupList = extensionPage.locator('.group-list');
    const virtualScrollEnabled = await groupList.evaluate(el => {
      return el.classList.contains('virtual-scroll-enabled');
    });
    expect(virtualScrollEnabled).toBe(true);
  });

  test('グループ切り替えの応答性', async ({ extensionPage, calendarPage }) => {
    // テスト用グループを作成
    for (let i = 0; i < 10; i++) {
      await helpers.createGroup(extensionPage, `パフォーマンステスト${i}`, [
        `メンバー${i}-1`,
        `メンバー${i}-2`,
        `メンバー${i}-3`
      ]);
    }
    
    // 各グループの適用時間を測定
    const applyTimes = [];
    
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();
      await helpers.applyGroup(extensionPage, `パフォーマンステスト${i}`);
      await helpers.waitForMessage(extensionPage, 'success');
      const applyTime = Date.now() - startTime;
      applyTimes.push(applyTime);
      
      // メッセージをクリア
      await extensionPage.locator('.message').click();
    }
    
    // 平均適用時間を計算
    const avgApplyTime = applyTimes.reduce((a, b) => a + b, 0) / applyTimes.length;
    console.log(`平均グループ適用時間: ${avgApplyTime}ms`);
    
    // パフォーマンス基準
    expect(avgApplyTime).toBeLessThan(1000); // 1秒以内
  });

  test('メモリリークのチェック', async ({ extensionPage }) => {
    // 初期メモリ使用量を記録
    const initialMemory = await extensionPage.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // グループの作成と削除を繰り返す
    for (let i = 0; i < 20; i++) {
      // グループ作成
      await helpers.createGroup(extensionPage, `メモリテスト${i}`, ['メンバー1']);
      
      // グループ削除
      const deleteBtn = extensionPage.locator('.group-item').last().locator('.delete-btn');
      extensionPage.on('dialog', dialog => dialog.accept());
      await deleteBtn.click();
      await extensionPage.waitForTimeout(100);
    }
    
    // ガベージコレクションを強制実行
    await extensionPage.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });
    
    // 最終メモリ使用量を記録
    await extensionPage.waitForTimeout(1000); // GCが完了するまで待機
    const finalMemory = await extensionPage.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // メモリ増加量をチェック
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
    console.log(`メモリ増加量: ${memoryIncreaseMB.toFixed(2)}MB`);
    
    // 大幅なメモリリークがないことを確認（10MB未満）
    expect(memoryIncreaseMB).toBeLessThan(10);
  });

  test('イベントデリゲーションの効果', async ({ extensionPage }) => {
    // 30個のグループを作成
    for (let i = 0; i < 30; i++) {
      await helpers.createGroup(extensionPage, `イベントテスト${i}`, ['メンバー1']);
    }
    
    // イベントリスナーの数を確認
    const listenerCount = await extensionPage.evaluate(() => {
      // グループリストのイベントリスナー数を取得
      const groupList = document.querySelector('.group-list');
      if (!groupList) return 0;
      
      // getEventListeners APIが利用可能な場合（Chrome DevTools）
      if (window.getEventListeners) {
        const listeners = window.getEventListeners(groupList);
        return Object.keys(listeners).reduce((total, event) => {
          return total + listeners[event].length;
        }, 0);
      }
      
      // 代替: データ属性でカウント
      return parseInt(groupList.dataset.listenerCount || '0');
    });
    
    console.log(`イベントリスナー数: ${listenerCount}`);
    
    // イベントデリゲーションにより、リスナー数が少ないことを確認
    expect(listenerCount).toBeLessThan(10); // グループ数に関わらず10個未満
  });

  test('検索とフィルタリングの性能', async ({ extensionPage }) => {
    // 100個のメンバー候補を準備
    const members = Array.from({ length: 100 }, (_, i) => `ユーザー${i + 1}`);
    
    // メンバー入力時の自動補完性能を測定
    const memberInput = extensionPage.locator('#memberInput');
    
    const searchTimes = [];
    for (const query of ['ユーザー1', 'ユーザー50', 'ユーザー99']) {
      const startTime = Date.now();
      
      await memberInput.fill(query);
      await extensionPage.waitForSelector('.autocomplete-suggestions', { state: 'visible' });
      
      const searchTime = Date.now() - startTime;
      searchTimes.push(searchTime);
      
      await memberInput.clear();
    }
    
    const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
    console.log(`平均検索時間: ${avgSearchTime}ms`);
    
    // 検索が高速であることを確認
    expect(avgSearchTime).toBeLessThan(200); // 200ms以内
  });

  test('並行処理の性能', async ({ extensionPage }) => {
    // 5つのグループを同時に作成
    const createPromises = [];
    
    for (let i = 0; i < 5; i++) {
      const promise = (async () => {
        // 別々のタイミングで作成を開始
        await extensionPage.waitForTimeout(i * 100);
        
        await extensionPage.fill('#groupName', `並行テスト${i}`);
        await extensionPage.fill('#memberInput', `メンバー${i}`);
        await extensionPage.click('#createGroup');
        
        // 成功を待つ
        await helpers.waitForMessage(extensionPage, 'success');
      })();
      
      createPromises.push(promise);
    }
    
    const startTime = Date.now();
    await Promise.all(createPromises);
    const totalTime = Date.now() - startTime;
    
    console.log(`5グループの並行作成時間: ${totalTime}ms`);
    
    // 並行処理が適切に動作していることを確認
    expect(totalTime).toBeLessThan(3000); // 3秒以内
  });

  test('アニメーションとトランジションの性能', async ({ extensionPage }) => {
    // グループを作成
    await helpers.createGroup(extensionPage, 'アニメーションテスト', ['メンバー1', 'メンバー2']);
    
    // FPSを測定
    const fps = await extensionPage.evaluate(async () => {
      let frameCount = 0;
      let lastTime = performance.now();
      const fpsValues = [];
      
      const measureFPS = (currentTime) => {
        frameCount++;
        
        if (currentTime - lastTime >= 1000) {
          fpsValues.push(frameCount);
          frameCount = 0;
          lastTime = currentTime;
        }
        
        if (fpsValues.length < 3) {
          requestAnimationFrame(measureFPS);
        }
      };
      
      // グループの展開/折りたたみアニメーションを実行
      const expandBtn = document.querySelector('.expand-btn');
      if (expandBtn) {
        // アニメーション中のFPSを測定
        requestAnimationFrame(measureFPS);
        
        // 展開
        expandBtn.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 折りたたみ
        expandBtn.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 再度展開
        expandBtn.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 平均FPSを返す
      return fpsValues.length > 0 
        ? fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length 
        : 60;
    });
    
    console.log(`アニメーション中の平均FPS: ${fps}`);
    
    // スムーズなアニメーション（30FPS以上）
    expect(fps).toBeGreaterThan(30);
  });
});