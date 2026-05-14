<template>
  <div class="app" :class="theme">
    <!-- 登录/注册页面 -->
    <div v-if="!isLoggedIn" class="login-page">
      <div class="login-container">
        <div class="login-header">
          <span class="login-icon">💰</span>
          <h1>家庭资产管理系统</h1>
        </div>
        
        <div class="login-tabs">
          <button :class="['tab', { active: loginMode === 'login' }]" @click="loginMode = 'login'">登录</button>
          <button :class="['tab', { active: loginMode === 'register' }]" @click="loginMode = 'register'">注册</button>
        </div>
        
        <form @submit.prevent="handleAuth" class="login-form">
          <div class="form-group">
            <label>用户名</label>
            <input v-model="authForm.username" type="text" required placeholder="请输入用户名" :disabled="authLoading">
          </div>
          
          <div class="form-group">
            <label>密码</label>
            <input v-model="authForm.password" type="password" required placeholder="请输入密码（至少6位）" minlength="6" :disabled="authLoading">
          </div>
          
          <div v-if="loginMode === 'register'" class="form-group">
            <label>确认密码</label>
            <input v-model="authForm.confirmPassword" type="password" required placeholder="请再次输入密码" :disabled="authLoading">
          </div>
          
          <div v-if="loginMode === 'register' && isFirstUser" class="first-user-hint">
            👑 您将成为管理员
          </div>
          
          <div v-if="authError" class="auth-error">{{ authError }}</div>
          
          <button type="submit" class="btn-login" :disabled="authLoading">
            {{ authLoading ? '处理中...' : (loginMode === 'login' ? '登录' : '注册') }}
          </button>
        </form>
        

      </div>
    </div>

    <!-- 主应用界面 -->
    <template v-else>
      <!-- 侧边栏 -->
      <aside class="sidebar">
        <div class="logo">
          <span class="logo-icon">💰</span>
          <span class="logo-text">家庭资产</span>
        </div>
        
        <nav class="nav">
          <button 
            v-for="item in navItems" 
            :key="item.id"
            :class="['nav-item', { active: activeTab === item.id }]"
            @click="activeTab = item.id"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-text">{{ item.name }}</span>
          </button>
        </nav>
        
      </aside>

      <!-- 主内容区 -->
      <main class="main">
        <header class="header">
          <h1>{{ currentTitle }}</h1>
          <div class="header-actions">
            <!-- 用户信息 -->
            <div class="user-info">
              <span class="username">{{ currentUser?.username }}</span>
              <span :class="['role-tag', currentUser?.role]">
                {{ currentUser?.role === 'admin' ? '管理员' : '成员' }}
              </span>
              <button class="btn-logout" @click="handleLogout">退出</button>
            </div>
            <button v-if="activeTab === 'assets' || activeTab === 'liabilities'" class="btn-primary" @click="openAddModal">
              + 添加{{ activeTab === 'assets' ? '资产' : '负债' }}
            </button>
            <button v-if="activeTab === 'categories'" class="btn-primary" @click="openCategoryModal">
              + 添加分类
            </button>
          </div>
        </header>

        <!-- 概览页 -->
        <div v-if="activeTab === 'overview'" class="overview">
          <div class="welcome-bar" v-if="currentUser">
            <span>👋 欢迎回来，<strong>{{ currentUser.username }}</strong></span>
          </div>

          <div class="stats-grid">
            <div class="stat-card cash-assets">
              <div class="stat-icon">💵</div>
              <div class="stat-content">
                <div class="stat-label">现金类资产</div>
                <div class="stat-value">{{ formatMoney(stats.cashAssets) }}</div>
                <div class="stat-sub">{{ stats.cashCount }} 项</div>
              </div>
            </div>
            
            <div class="stat-card other-assets">
              <div class="stat-icon">🏠</div>
              <div class="stat-content">
                <div class="stat-label">其他资产</div>
                <div class="stat-value">{{ formatMoney(stats.otherAssets) }}</div>
                <div class="stat-sub">{{ stats.otherCount }} 项</div>
              </div>
            </div>
            
            <div class="stat-card total-liabilities">
              <div class="stat-icon">📉</div>
              <div class="stat-content">
                <div class="stat-label">总负债</div>
                <div class="stat-value">{{ formatMoney(stats.totalLiabilities) }}</div>
                <div class="stat-sub">月还款 {{ formatMoney(stats.monthlyPayment) }}</div>
              </div>
            </div>
            
            <div class="stat-card net-worth">
              <div class="stat-icon">💎</div>
              <div class="stat-content">
                <div class="stat-label">净资产</div>
                <div class="stat-value" :class="{ negative: stats.netWorth < 0 }">
                  {{ formatMoney(stats.netWorth) }}
                </div>
              </div>
            </div>
          </div>

          <!-- 负债还款概览 -->
          <div v-if="liabilities.length > 0" class="repayment-section">
            <div class="section-header">
              <h3>📋 负债还款计划</h3>
            </div>
            <div class="repayment-grid">
              <div v-for="item in liabilitiesWithPayment" :key="item.id" class="repayment-card">
                <div class="repayment-header">
                  <span class="repayment-name">{{ item.name }}</span>
                  <span class="repayment-category">{{ item.category }}</span>
                </div>
                <div class="repayment-body">
                  <div class="repayment-row">
                    <span class="label">剩余本金</span>
                    <span class="value">{{ formatMoney(item.amount) }}</span>
                  </div>
                  <div v-if="item.interest_rate" class="repayment-row">
                    <span class="label">年利率</span>
                    <span class="value">{{ item.interest_rate }}%</span>
                  </div>
                  <div v-if="item.monthly_payment" class="repayment-row highlight">
                    <span class="label">月还款额</span>
                    <span class="value">{{ formatMoney(item.monthly_payment) }}</span>
                  </div>
                  <div v-if="item.remain_months" class="repayment-row">
                    <span class="label">剩余期数</span>
                    <span class="value">{{ item.remain_months }} 期</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 资产负债概览 -->
          <div class="summary-section">
            <div class="summary-card">
              <h3>📊 资产构成</h3>
              <div class="summary-row">
                <span class="summary-label">💵 现金类</span>
                <span class="summary-value">{{ formatMoney(stats.cashAssets) }}</span>
                <span class="summary-percent">{{ getPercent(stats.cashAssets, stats.totalAssets) }}%</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">🏠 其他资产</span>
                <span class="summary-value">{{ formatMoney(stats.otherAssets) }}</span>
                <span class="summary-percent">{{ getPercent(stats.otherAssets, stats.totalAssets) }}%</span>
              </div>
              <div class="summary-row total">
                <span class="summary-label">总资产</span>
                <span class="summary-value">{{ formatMoney(stats.totalAssets) }}</span>
              </div>
            </div>

            <div class="summary-card">
              <h3>📈 资产质量</h3>
              <div class="quality-item">
                <div class="quality-label">
                  <span>现金占比</span>
                  <span class="quality-value">{{ getPercent(stats.cashAssets, stats.totalAssets) }}%</span>
                </div>
                <div class="quality-bar">
                  <div class="quality-fill cash" :style="{ width: getPercent(stats.cashAssets, stats.totalAssets) + '%' }"></div>
                </div>
              </div>
              <div class="quality-item">
                <div class="quality-label">
                  <span>负债率</span>
                  <span class="quality-value" :class="{ warning: getLiabilityRate() > 50, danger: getLiabilityRate() > 70 }">
                    {{ getLiabilityRate() }}%
                  </span>
                </div>
                <div class="quality-bar">
                  <div class="quality-fill liability" :style="{ width: Math.min(getLiabilityRate(), 100) + '%' }"></div>
                </div>
              </div>
              <div class="quality-hint">
                {{ getQualityHint() }}
              </div>
            </div>
          </div>

          <!-- 分布图 -->
          <div class="charts-section">
            <div class="chart-card">
              <h3>💵 现金类分布</h3>
              <div class="chart-bars">
                <div 
                  v-for="item in stats.cashByCategory" 
                  :key="item.name" 
                  class="chart-bar-item"
                >
                  <div class="bar-label">
                    <span class="bar-icon">{{ item.icon }}</span>
                    <span>{{ item.name }}</span>
                  </div>
                  <div class="bar-container">
                    <div class="bar-fill cash" :style="{ width: getBarWidth(item.total, stats.cashAssets) + '%', backgroundColor: item.color }"></div>
                  </div>
                  <div class="bar-value">{{ formatMoney(item.total) }}</div>
                </div>
                <div v-if="stats.cashByCategory.length === 0" class="empty-chart">暂无现金类资产</div>
              </div>
            </div>

            <div class="chart-card">
              <h3>🏠 其他资产分布</h3>
              <div class="chart-bars">
                <div 
                  v-for="item in stats.otherByCategory" 
                  :key="item.name" 
                  class="chart-bar-item"
                >
                  <div class="bar-label">
                    <span class="bar-icon">{{ item.icon }}</span>
                    <span>{{ item.name }}</span>
                  </div>
                  <div class="bar-container">
                    <div class="bar-fill other" :style="{ width: getBarWidth(item.total, stats.otherAssets) + '%', backgroundColor: item.color }"></div>
                  </div>
                  <div class="bar-value">{{ formatMoney(item.total) }}</div>
                </div>
                <div v-if="stats.otherByCategory.length === 0" class="empty-chart">暂无其他资产</div>
              </div>
            </div>

            <div class="chart-card">
              <h3>📉 负债分布</h3>
              <div class="chart-bars">
                <div 
                  v-for="item in stats.liabilitiesByCategory" 
                  :key="item.name" 
                  class="chart-bar-item"
                >
                  <div class="bar-label">
                    <span class="bar-icon">{{ item.icon }}</span>
                    <span>{{ item.name }}</span>
                  </div>
                  <div class="bar-container">
                    <div class="bar-fill liability" :style="{ width: getBarWidth(item.total, stats.totalLiabilities) + '%' }"></div>
                  </div>
                  <div class="bar-value">{{ formatMoney(item.total) }}</div>
                </div>
                <div v-if="stats.liabilitiesByCategory.length === 0" class="empty-chart">暂无负债</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 资产列表 -->
        <div v-else-if="activeTab === 'assets'" class="list-view">
          <div class="filter-bar">
            <select v-model="filterCategory" class="filter-select">
              <option value="">全部分类</option>
              <option v-for="cat in assetCategories" :key="cat.id" :value="cat.name">{{ cat.icon }} {{ cat.name }}</option>
            </select>
            <select v-model="filterTag" class="filter-select">
              <option value="">全部标签</option>
              <option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
            </select>
          </div>
          <div class="list-header">
            <span class="col-name">名称</span>
            <span class="col-type">类型</span>
            <span class="col-category">分类</span>
            <span class="col-tags">标签</span>
            <span class="col-value">价值</span>
            <span class="col-date">购买日期</span>
            <span class="col-actions">操作</span>
          </div>
          
          <div class="list-body">
            <div v-for="item in filteredAssets" :key="item.id" class="list-row">
              <span class="col-name">{{ item.name }}</span>
              <span class="col-type">
                <span :class="['type-tag', item.is_cash ? 'cash' : 'other']">
                  {{ item.is_cash ? '💵 现金' : '🏠 其他' }}
                </span>
              </span>
              <span class="col-category">
                <span class="category-tag">{{ item.category }}</span>
              </span>
              <span class="col-tags">
                <span v-for="t in getItemTags(item)" :key="t.id" class="tag-pill" :style="{ backgroundColor: t.color + '22', color: t.color, borderColor: t.color + '44' }">
                  {{ t.name }}
                </span>
                <span v-if="getItemTags(item).length === 0" class="text-muted">-</span>
              </span>
              <span class="col-value highlight">{{ formatMoney(item.value) }}</span>
              <span class="col-date">{{ item.purchase_date || '-' }}</span>
              <span class="col-actions">
                <button class="btn-icon" @click="editAsset(item)">✏️</button>
                <button class="btn-icon danger" @click="deleteAsset(item.id)">🗑️</button>
              </span>
            </div>
            
            <div v-if="assets.length === 0" class="empty-state">暂无资产记录，点击右上角添加</div>
          </div>
        </div>

        <!-- 负债列表 -->
        <div v-else-if="activeTab === 'liabilities'" class="list-view liability-list">
          <div class="filter-bar">
            <select v-model="filterLiabCategory" class="filter-select">
              <option value="">全部分类</option>
              <option v-for="cat in liabilityCategories" :key="cat.id" :value="cat.name">{{ cat.icon }} {{ cat.name }}</option>
            </select>
            <select v-model="filterLiabTag" class="filter-select">
              <option value="">全部标签</option>
              <option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
            </select>
          </div>
          <div class="list-header">
            <span class="col-name">名称</span>
            <span class="col-category">分类</span>
            <span class="col-tags">标签</span>
            <span class="col-amount">金额</span>
            <span class="col-rate">利率</span>
            <span class="col-payment">月还款</span>
            <span class="col-actions">操作</span>
          </div>
          
          <div class="list-body">
            <div v-for="item in filteredLiabilities" :key="item.id" class="list-row">
              <span class="col-name">{{ item.name }}</span>
              <span class="col-category">
                <span class="category-tag liability">{{ item.category }}</span>
              </span>
              <span class="col-tags">
                <span v-for="t in getItemTags(item)" :key="t.id" class="tag-pill" :style="{ backgroundColor: t.color + '22', color: t.color, borderColor: t.color + '44' }">
                  {{ t.name }}
                </span>
                <span v-if="getItemTags(item).length === 0" class="text-muted">-</span>
              </span>
              <span class="col-amount">{{ formatMoney(item.amount) }}</span>
              <span class="col-rate">{{ item.interest_rate ? item.interest_rate + '%' : '-' }}</span>
              <span class="col-payment">{{ item.monthly_payment ? formatMoney(item.monthly_payment) : '-' }}</span>
              <span class="col-actions">
                <button class="btn-icon" @click="editLiability(item)">✏️</button>
                <button class="btn-icon danger" @click="deleteLiability(item.id)">🗑️</button>
              </span>
            </div>
            
            <div v-if="liabilities.length === 0" class="empty-state">暂无负债记录，点击右上角添加</div>
          </div>
        </div>

        <!-- 分类管理 -->
        <div v-else-if="activeTab === 'categories'" class="categories-view">
          <div class="category-section">
            <h3>📈 资产分类</h3>
            <div class="category-grid">
              <div v-for="cat in assetCategories" :key="cat.id" class="category-card">
                <span class="category-icon">{{ cat.icon }}</span>
                <span class="category-name">{{ cat.name }}</span>
                <div class="category-actions">
                  <button class="btn-icon" @click="editCategory(cat)">✏️</button>
                  <button class="btn-icon danger" @click="deleteCategory(cat.id)">🗑️</button>
                </div>
              </div>
            </div>
          </div>

          <div class="category-section">
            <h3>📉 负债分类</h3>
            <div class="category-grid">
              <div v-for="cat in liabilityCategories" :key="cat.id" class="category-card">
                <span class="category-icon">{{ cat.icon }}</span>
                <span class="category-name">{{ cat.name }}</span>
                <div class="category-actions">
                  <button class="btn-icon" @click="editCategory(cat)">✏️</button>
                  <button class="btn-icon danger" @click="deleteCategory(cat.id)">🗑️</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 标签区域 -->
          <div class="category-section tags-section">
            <div class="section-header-row">
              <h3>🏷️ 标签</h3>
              <button class="btn-primary btn-sm" @click="openTagModal">+ 添加标签</button>
            </div>
            <div v-if="tags.length === 0" class="empty-state text-muted" style="font-size:13px">暂无标签，点击上方按钮添加</div>
            <div class="tags-grid">
              <div v-for="tag in tags" :key="tag.id" class="tag-card">
                <div class="tag-card-header">
                  <span class="tag-color-dot" :style="{ backgroundColor: tag.color }"></span>
                  <span class="tag-card-name">{{ tag.name }}</span>
                  <div class="tag-card-actions">
                    <button class="btn-icon" @click="editTag(tag)">✏️</button>
                    <button class="btn-icon danger" @click="deleteTag(tag.id)">🗑️</button>
                  </div>
                </div>
                <div class="tag-card-footer">
                  关联资产: <strong>{{ getTagAssetCount(tag.id) }}</strong> 项
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 设置页 -->
        <div v-else-if="activeTab === 'settings'" class="settings-view">
          <!-- 修改密码 -->
          <div class="settings-card">
            <h3>🔒 修改密码</h3>
            <p class="settings-desc">修改当前登录账户的密码。</p>
            <form @submit.prevent="changePassword" class="settings-form">
              <div class="form-group">
                <label>当前密码</label>
                <input v-model="currentPassword" type="password" required placeholder="请输入当前密码" :disabled="passwordLoading">
              </div>
              <div class="form-group">
                <label>新密码</label>
                <input v-model="newPassword" type="password" required placeholder="至少6位" minlength="6" :disabled="passwordLoading">
              </div>
              <div class="form-group">
                <label>确认新密码</label>
                <input v-model="confirmPassword" type="password" required placeholder="再次输入新密码" :disabled="passwordLoading">
              </div>
              <div v-if="passwordMessage" :class="['backup-message', passwordMessageType]">
                {{ passwordMessage }}
              </div>
              <div class="modal-actions" style="margin-top:16px">
                <button type="submit" class="btn-primary" :disabled="passwordLoading">
                  {{ passwordLoading ? '提交中...' : '修改密码' }}
                </button>
              </div>
            </form>
          </div>

          <!-- 添加新账户（仅管理员） -->
          <div v-if="currentUser?.role === 'admin'" class="settings-card" style="margin-top:24px">
            <h3>👤 添加新账户</h3>
            <p class="settings-desc">创建新的家庭成员账户。</p>
            <form @submit.prevent="addNewAccount" class="settings-form">
              <div class="form-group">
                <label>用户名</label>
                <input v-model="newAccountUsername" type="text" required placeholder="请输入用户名" :disabled="accountLoading">
              </div>
              <div class="form-group">
                <label>密码</label>
                <input v-model="newAccountPassword" type="password" required placeholder="至少6位" minlength="6" :disabled="accountLoading">
              </div>
              <div class="form-group">
                <label>确认密码</label>
                <input v-model="newAccountConfirmPassword" type="password" required placeholder="再次输入密码" :disabled="accountLoading">
              </div>
              <div v-if="accountMessage" :class="['backup-message', accountMessageType]">
                {{ accountMessage }}
              </div>
              <div class="modal-actions" style="margin-top:16px">
                <button type="submit" class="btn-primary" :disabled="accountLoading">
                  {{ accountLoading ? '提交中...' : '创建账户' }}
                </button>
              </div>
            </form>
          </div>

          <!-- 数据备份与恢复 -->
          <div class="settings-card" style="margin-top:24px">
            <h3>💾 数据备份与恢复</h3>
            <p class="settings-desc">导出所有数据为 JSON 文件，或从备份文件恢复数据。</p>
            <div class="settings-actions">
              <button class="btn-primary" @click="exportBackup" :disabled="backupLoading">
                {{ backupLoading ? '导出中...' : '📥 导出数据' }}
              </button>
              <label class="btn-secondary btn-upload" :class="{ disabled: backupLoading }">
                📤 导入数据
                <input type="file" accept=".json" @change="importBackup" :disabled="backupLoading" style="display:none">
              </label>
            </div>
            <div v-if="backupMessage" :class="['backup-message', backupMessageType]">
              {{ backupMessage }}
            </div>
          </div>
        </div>
      </main>

      <!-- 添加/编辑资产/负债弹窗 -->
      <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal" :class="{ large: activeTab === 'liabilities' }">
          <div class="modal-header">
            <h3>{{ editingItem ? '编辑' : '添加' }}{{ activeTab === 'assets' ? '资产' : '负债' }}</h3>
            <button class="btn-close" @click="closeModal">×</button>
          </div>
          
          <form @submit.prevent="submitForm" class="modal-body">
            <div class="form-group">
              <label>名称</label>
              <input v-model="form.name" type="text" required placeholder="例如：工资卡存款">
            </div>
            
            <div class="form-group">
              <label>分类</label>
              <div class="category-select">
                <select v-model="form.category" required>
                  <option v-for="cat in relevantCategories" :key="cat.id" :value="cat.name">
                    {{ cat.icon }} {{ cat.name }}
                  </option>
                </select>
                <button type="button" class="btn-add-category" @click="openCategoryModalFromForm" title="添加新分类">+</button>
              </div>
            </div>

            <!-- 标签选择器 -->
            <div class="form-group">
              <label>标签</label>
              <div class="tag-selector">
                <div v-for="tag in tags" :key="tag.id" 
                     :class="['tag-check-item', { checked: form.tagIds.includes(tag.id) }]"
                     @click="toggleFormTag(tag.id)">
                  <span class="tag-color-dot" :style="{ backgroundColor: tag.color }"></span>
                  <span>{{ tag.name }}</span>
                  <span class="tag-check-mark">{{ form.tagIds.includes(tag.id) ? '✓' : '' }}</span>
                </div>
                <div v-if="tags.length === 0" class="text-muted" style="font-size:13px;">暂无标签，请先在标签页创建</div>
              </div>
            </div>
            
            <!-- 资产类型选择 -->
            <div v-if="activeTab === 'assets'" class="form-group">
              <label>资产类型</label>
              <div class="type-selector">
                <button type="button" :class="['type-option', { active: form.is_cash }]" @click="form.is_cash = true">
                  💵 现金类
                </button>
                <button type="button" :class="['type-option', { active: !form.is_cash }]" @click="form.is_cash = false">
                  🏠 其他资产
                </button>
              </div>
              <div class="type-hint">
                {{ form.is_cash ? '现金、银行存款、货币基金等可随时使用的资金' : '房产、车辆、股票等变现周期较长的资产' }}
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>{{ activeTab === 'assets' ? '价值' : '剩余本金' }}</label>
                <input v-model.number="form.value" type="number" required min="0" step="0.01">
              </div>
              <div class="form-group">
                <label>币种</label>
                <select v-model="form.currency">
                  <option value="CNY">CNY ¥</option>
                  <option value="USD">USD $</option>
                  <option value="EUR">EUR €</option>
                </select>
              </div>
            </div>
            
            <!-- 负债还款设置 -->
            <div v-if="activeTab === 'liabilities'" class="repayment-form">
              <h4>还款设置（可选）</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>年利率 (%)</label>
                  <input v-model.number="form.interest_rate" type="number" min="0" step="0.01" placeholder="如 4.9">
                </div>
                <div class="form-group">
                  <label>剩余期数（月）</label>
                  <input v-model.number="form.remain_months" type="number" min="1" placeholder="如 360">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>还款方式</label>
                  <select v-model="form.repayment_type">
                    <option value="equal">等额本息</option>
                    <option value="principal">等额本金</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>每月还款日</label>
                  <input v-model.number="form.repayment_day" type="number" min="1" max="28" placeholder="1-28">
                </div>
              </div>
              
              <!-- 计算结果预览 -->
              <div v-if="calculatedPayment" class="payment-preview">
                <div class="preview-row">
                  <span>预估月还款</span>
                  <span class="preview-value">{{ formatMoney(calculatedPayment.monthly) }}</span>
                </div>
                <div v-if="form.repayment_type === 'principal'" class="preview-row">
                  <span>首月还款</span>
                  <span class="preview-value">{{ formatMoney(calculatedPayment.firstMonth) }}</span>
                </div>
                <div v-if="form.remain_months" class="preview-row">
                  <span>总利息</span>
                  <span class="preview-value">{{ formatMoney(calculatedPayment.totalInterest) }}</span>
                </div>
              </div>
            </div>
            
            <div class="form-group">
              <label>{{ activeTab === 'assets' ? '购买日期' : '贷款起始日期' }}</label>
              <input v-model="form.date" type="date">
            </div>
            
            <div class="form-group">
              <label>备注</label>
              <textarea v-model="form.description" placeholder="可选备注信息"></textarea>
            </div>
            
            <div v-if="activeTab === 'assets'" class="form-group">
              <label>存放位置</label>
              <input v-model="form.location" type="text" placeholder="例如：中国银行">
            </div>
            
            <div class="modal-actions">
              <button type="button" class="btn-secondary" @click="closeModal">取消</button>
              <button type="submit" class="btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>

      <!-- 分类弹窗 -->
      <div v-if="showCategoryModal" class="modal-overlay" @click.self="showCategoryModal = false">
        <div class="modal">
          <div class="modal-header">
            <h3>{{ editingCategory ? '编辑' : '添加' }}分类</h3>
            <button class="btn-close" @click="showCategoryModal = false">×</button>
          </div>
          
          <form @submit.prevent="submitCategory" class="modal-body">
            <div class="form-group">
              <label>分类名称</label>
              <input v-model="categoryForm.name" type="text" required placeholder="例如：定期存款">
            </div>
            
            <div class="form-group">
              <label>类型</label>
              <select v-model="categoryForm.type" :disabled="!!editingCategory">
                <option value="asset">资产分类</option>
                <option value="liability">负债分类</option>
              </select>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>图标</label>
                <input v-model="categoryForm.icon" type="text" placeholder="如 💰" maxlength="2">
              </div>
              <div class="form-group">
                <label>颜色</label>
                <input v-model="categoryForm.color" type="color" value="#3b82f6">
              </div>
            </div>
            
            <div class="modal-actions">
              <button type="button" class="btn-secondary" @click="showCategoryModal = false">取消</button>
              <button type="submit" class="btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>

      <!-- 标签弹窗 -->
      <div v-if="showTagModal" class="modal-overlay" @click.self="showTagModal = false">
        <div class="modal">
          <div class="modal-header">
            <h3>{{ editingTag ? '编辑' : '添加' }}标签</h3>
            <button class="btn-close" @click="showTagModal = false">×</button>
          </div>
          
          <form @submit.prevent="submitTag" class="modal-body">
            <div class="form-group">
              <label>标签名称</label>
              <input v-model="tagForm.name" type="text" required placeholder="例如：紧急备用金">
            </div>
            
            <div class="form-group">
              <label>颜色</label>
              <div class="color-picker">
                <button 
                  v-for="c in presetColors" 
                  :key="c" 
                  type="button"
                  :class="['color-option', { active: tagForm.color === c }]"
                  :style="{ backgroundColor: c }"
                  @click="tagForm.color = c"
                ></button>
              </div>
              <div class="form-row" style="margin-top:12px;">
                <div class="form-group">
                  <label>自定义颜色</label>
                  <input v-model="tagForm.color" type="color">
                </div>
              </div>
            </div>
            
            <div class="modal-actions">
              <button type="button" class="btn-secondary" @click="showTagModal = false">取消</button>
              <button type="submit" class="btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>
    </template>
    
    <!-- 全局主题切换按钮 -->
    <button class="theme-fab" @click="toggleTheme" :title="theme === 'dark' ? '切换亮色' : '切换暗色'">
      {{ theme === 'dark' ? '☀️' : '🌙' }}
    </button>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

export default {
  name: 'App',
  setup() {
    const theme = ref('light')
    
    // 认证状态
    const isLoggedIn = ref(false)
    const currentUser = ref(null)
    const token = ref(null)
    const loginMode = ref('login')
    const authLoading = ref(false)
    const authError = ref('')
    const isFirstUser = ref(false)
    
    const authForm = ref({
      username: '',
      password: '',
      confirmPassword: ''
    })
    
    const initTheme = () => {
      const saved = localStorage.getItem('theme')
      if (saved) {
        theme.value = saved
      } else {
        theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
    }
    
    const toggleTheme = () => {
      theme.value = theme.value === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', theme.value)
    }
    
    initTheme()
    
    // 配置 axios 拦截器
    const setupAxiosInterceptors = () => {
      axios.interceptors.request.use(
        (config) => {
          const savedToken = localStorage.getItem('token')
          if (savedToken) {
            config.headers.Authorization = `Bearer ${savedToken}`
          }
          return config
        },
        (error) => Promise.reject(error)
      )
      
      axios.interceptors.response.use(
        (response) => response,
        (error) => {
          if (error.response) {
            if (error.response.status === 401) {
              localStorage.removeItem('token')
              localStorage.removeItem('user')
              isLoggedIn.value = false
              currentUser.value = null
              token.value = null
            } else if (error.response.status === 403) {
              alert('权限不足')
            }
          }
          return Promise.reject(error)
        }
      )
    }
    
    // 检查登录状态
    const checkAuth = async () => {
      try {
        const statusRes = await axios.get('/api/auth/status')
        isFirstUser.value = statusRes.data.isFirstUser
      } catch (e) {}

      const savedToken = localStorage.getItem('token')
      const savedUser = localStorage.getItem('user')

      if (!savedToken) {
        isLoggedIn.value = false
        return
      }
      
      try {
        const res = await axios.get('/api/auth/me')
        currentUser.value = res.data
        token.value = savedToken
        isLoggedIn.value = true
      } catch (err) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        isLoggedIn.value = false
        currentUser.value = null
        token.value = null
      }
    }
    
    // 登录/注册处理
    const handleAuth = async () => {
      authError.value = ''
      
      if (authForm.value.password.length < 6) {
        authError.value = '密码至少需要6位'
        return
      }
      
      if (loginMode.value === 'register' && authForm.value.password !== authForm.value.confirmPassword) {
        authError.value = '两次输入的密码不一致'
        return
      }
      
      authLoading.value = true
      
      try {
        const url = loginMode.value === 'login' ? '/api/auth/login' : '/api/auth/register'
        const payload = loginMode.value === 'login' 
          ? { username: authForm.value.username, password: authForm.value.password }
          : { username: authForm.value.username, password: authForm.value.password }
        
        const res = await axios.post(url, payload)
        
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data))
        
        token.value = res.data.token
        currentUser.value = res.data
        isLoggedIn.value = true
        
        authForm.value = { username: '', password: '', confirmPassword: '' }
        
        fetchData()
      } catch (err) {
        if (err.response?.data?.error) {
          authError.value = err.response.data.error
        } else {
          authError.value = loginMode.value === 'login' ? '登录失败，请检查用户名和密码' : '注册失败，请重试'
        }
      } finally {
        authLoading.value = false
      }
    }
    
    const handleLogout = async () => {
      try {
        await axios.post('/api/auth/logout')
      } catch (err) {}
      
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      isLoggedIn.value = false
      currentUser.value = null
      token.value = null
    }
    
    // 导航
    const activeTab = ref('overview')
    const navItems = [
      { id: 'overview', name: '概览', icon: '📊' },
      { id: 'assets', name: '资产', icon: '📈' },
      { id: 'liabilities', name: '负债', icon: '📉' },
      { id: 'categories', name: '分类管理', icon: '📁' },
      { id: 'settings', name: '设置', icon: '⚙️' }
    ]
    
    // 数据
    const stats = ref({
      totalAssets: 0,
      cashAssets: 0,
      otherAssets: 0,
      totalLiabilities: 0,
      monthlyPayment: 0,
      netWorth: 0,
      assetCount: 0,
      cashCount: 0,
      otherCount: 0,
      liabilityCount: 0,
      cashByCategory: [],
      otherByCategory: [],
      liabilitiesByCategory: []
    })
    
    const assets = ref([])
    const liabilities = ref([])
    const categories = ref([])
    const tags = ref([])
    
    // 弹窗状态
    const showAddModal = ref(false)
    const showCategoryModal = ref(false)
    const showTagModal = ref(false)
    const editingItem = ref(null)
    const editingCategory = ref(null)
    const editingTag = ref(null)
    const categoryModalType = ref('asset')
    
    // 表单数据
    const form = ref({
      name: '',
      category: '',
      value: 0,
      currency: 'CNY',
      date: '',
      description: '',
      location: '',
      is_cash: true,
      interest_rate: null,
      remain_months: null,
      repayment_type: 'equal',
      repayment_day: null,
      tagIds: []
    })
    
    const categoryForm = ref({
      name: '',
      type: 'asset',
      icon: '📦',
      color: '#3b82f6'
    })

    const tagForm = ref({
      name: '',
      color: '#3b82f6'
    })

    const filterCategory = ref('')
    const filterTag = ref('')
    const filterLiabCategory = ref('')
    const filterLiabTag = ref('')

    // 标签预设颜色
    const presetColors = [
      '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6',
      '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'
    ]

    // 备份相关
    const backupLoading = ref(false)
    const backupMessage = ref('')
    const backupMessageType = ref('success')
    
    // 密码修改相关
    const currentPassword = ref('')
    const newPassword = ref('')
    const confirmPassword = ref('')
    const passwordLoading = ref(false)
    const passwordMessage = ref('')
    const passwordMessageType = ref('success')
    
    // 添加账户相关
    const newAccountUsername = ref('')
    const newAccountPassword = ref('')
    const newAccountConfirmPassword = ref('')
    const accountLoading = ref(false)
    const accountMessage = ref('')
    const accountMessageType = ref('success')
    
    // 计算属性
    const currentTitle = computed(() => {
      const item = navItems.find(n => n.id === activeTab.value)
      return item ? item.name : '概览'
    })
    
    const relevantCategories = computed(() => {
      const type = activeTab.value === 'assets' ? 'asset' : 'liability'
      return categories.value.filter(c => c.type === type)
    })
    
    const assetCategories = computed(() => categories.value.filter(c => c.type === 'asset'))
    const liabilityCategories = computed(() => categories.value.filter(c => c.type === 'liability'))
    
    // 计算负债月还款
    const liabilitiesWithPayment = computed(() => {
      return liabilities.value.map(item => {
        let monthly_payment = null
        
        if (item.interest_rate && item.remain_months) {
          const principal = item.amount
          const monthlyRate = item.interest_rate / 100 / 12
          const months = item.remain_months
          
          if (item.repayment_type === 'equal') {
            if (monthlyRate > 0) {
              monthly_payment = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1)
            } else {
              monthly_payment = principal / months
            }
          } else {
            monthly_payment = principal / months + principal * monthlyRate
          }
        }
        
        return { ...item, monthly_payment }
      })
    })
    
    // 计算表单预览
    const calculatedPayment = computed(() => {
      if (!form.value.interest_rate || !form.value.remain_months || !form.value.value) return null
      
      const principal = form.value.value
      const monthlyRate = form.value.interest_rate / 100 / 12
      const months = form.value.remain_months
      
      let monthly, firstMonth, totalInterest
      
      if (form.value.repayment_type === 'equal') {
        if (monthlyRate > 0) {
          monthly = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1)
        } else {
          monthly = principal / months
        }
        totalInterest = monthly * months - principal
        return { monthly, totalInterest }
      } else {
        const monthlyPrincipal = principal / months
        firstMonth = monthlyPrincipal + principal * monthlyRate
        totalInterest = (months + 1) * principal * monthlyRate / 2
        monthly = principal / months + (principal + monthlyPrincipal) * monthlyRate / 2
        return { monthly, firstMonth, totalInterest }
      }
    })

    // 标签辅助方法
    const getItemTags = (item) => {
      if (!item.tag_id) return []
      return tags.value.filter(t => t.id === item.tag_id)
    }

    const getTagAssetCount = (tagId) => {
      const count = assets.value.filter(a => a.tag_id === tagId).length
      const lCount = liabilities.value.filter(l => l.tag_id === tagId).length
      return count + lCount
    }

    const toggleFormTag = (tagId) => {
      const idx = form.value.tagIds.indexOf(tagId)
      if (idx >= 0) {
        form.value.tagIds.splice(idx, 1)
      } else {
        form.value.tagIds.push(tagId)
      }
    }

    // 资产筛选
    const filteredAssets = computed(() => {
      return assets.value.filter(a => {
        if (filterCategory.value && a.category !== filterCategory.value) return false
        if (filterTag.value) {
          const itemTagIds = a.tag_id ? [a.tag_id] : []
          if (!itemTagIds.includes(filterTag.value)) return false
        }
        return true
      })
    })

    // 负债筛选
    const filteredLiabilities = computed(() => {
      return liabilitiesWithPayment.value.filter(l => {
        if (filterLiabCategory.value && l.category !== filterLiabCategory.value) return false
        if (filterLiabTag.value) {
          const itemTagIds = l.tag_id ? [l.tag_id] : []
          if (!itemTagIds.includes(filterLiabTag.value)) return false
        }
        return true
      })
    })
    
    // 工具方法
    const formatMoney = (value) => {
      return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value || 0)
    }
    
    const getPercent = (part, total) => {
      if (!total) return 0
      return Math.round((part / total) * 100)
    }
    
    const getLiabilityRate = () => {
      if (!stats.value.totalAssets) return 0
      return Math.round((stats.value.totalLiabilities / stats.value.totalAssets) * 100)
    }
    
    const getQualityHint = () => {
      const cashRate = getPercent(stats.value.cashAssets, stats.value.totalAssets)
      const liabilityRate = getLiabilityRate()
      
      if (liabilityRate > 70) return '⚠️ 负债率较高，建议控制债务规模'
      if (liabilityRate > 50) return '💡 负债率中等，注意现金流管理'
      if (cashRate < 10) return '💡 现金占比较低，建议保留应急资金'
      if (cashRate > 50) return '✅ 现金充裕，流动性良好'
      return '✅ 资产配置均衡'
    }
    
    const getBarWidth = (value, total) => {
      if (!total) return 0
      return Math.max(5, (value / total) * 100)
    }
    
    // 数据加载
    const fetchData = async () => {
      try {
        const [statsRes, assetsRes, liabilitiesRes, categoriesRes, tagsRes] = await Promise.all([
          axios.get('/api/stats/overview'),
          axios.get('/api/assets'),
          axios.get('/api/liabilities'),
          axios.get('/api/categories'),
          axios.get('/api/tags')
        ])
        
        stats.value = statsRes.data
        assets.value = assetsRes.data
        liabilities.value = liabilitiesRes.data
        categories.value = categoriesRes.data
        tags.value = tagsRes.data
      } catch (err) {
        console.error('数据加载失败:', err)
      }
    }
    
    // 资产/负债弹窗
    const openAddModal = () => {
      editingItem.value = null
      form.value = {
        name: '',
        category: relevantCategories.value[0]?.name || '',
        value: 0,
        currency: 'CNY',
        date: '',
        description: '',
        location: '',
        is_cash: true,
        interest_rate: null,
        remain_months: null,
        repayment_type: 'equal',
        repayment_day: null,
        tagIds: tags.value[0]?.id ? [tags.value[0].id] : []
      }
      showAddModal.value = true
    }
    
    const closeModal = () => {
      showAddModal.value = false
      editingItem.value = null
    }
    
    const editAsset = (item) => {
      editingItem.value = item
      form.value = {
        name: item.name,
        category: item.category,
        value: item.value,
        currency: item.currency,
        date: item.purchase_date || '',
        description: item.description || '',
        location: item.location || '',
        is_cash: item.is_cash === 1 || item.is_cash === true,
        interest_rate: null,
        remain_months: null,
        repayment_type: 'equal',
        repayment_day: null,
        tagIds: item.tag_id ? [item.tag_id] : []
      }
      showAddModal.value = true
    }
    
    const editLiability = (item) => {
      editingItem.value = item
      form.value = {
        name: item.name,
        category: item.category,
        value: item.amount,
        currency: item.currency,
        date: item.start_date || '',
        description: item.description || '',
        location: '',
        is_cash: false,
        interest_rate: item.interest_rate,
        remain_months: item.remain_months,
        repayment_type: item.repayment_type || 'equal',
        repayment_day: item.repayment_day,
        tagIds: item.tag_id ? [item.tag_id] : []
      }
      showAddModal.value = true
    }
    
    const submitForm = async () => {
      try {
        const isAsset = activeTab.value === 'assets'
        const url = isAsset ? '/api/assets' : '/api/liabilities'
        
        const payload = isAsset ? {
          name: form.value.name,
          category: form.value.category,
          value: form.value.value,
          currency: form.value.currency,
          purchase_date: form.value.date,
          description: form.value.description,
          location: form.value.location,
          is_cash: form.value.is_cash,
          tag_id: form.value.tagIds[0] || null
        } : {
          name: form.value.name,
          category: form.value.category,
          amount: form.value.value,
          currency: form.value.currency,
          start_date: form.value.date,
          description: form.value.description,
          interest_rate: form.value.interest_rate,
          remain_months: form.value.remain_months,
          repayment_type: form.value.repayment_type,
          repayment_day: form.value.repayment_day,
          tag_id: form.value.tagIds[0] || null
        }
        
        if (editingItem.value) {
          await axios.put(`${url}/${editingItem.value.id}`, payload)
        } else {
          await axios.post(url, payload)
        }
        
        closeModal()
        fetchData()
      } catch (err) {
        console.error('保存失败:', err)
        alert('保存失败，请重试')
      }
    }
    
    const deleteAsset = async (id) => {
      if (!confirm('确定删除此资产记录？')) return
      try {
        await axios.delete(`/api/assets/${id}`)
        fetchData()
      } catch (err) {
        console.error('删除失败:', err)
      }
    }
    
    const deleteLiability = async (id) => {
      if (!confirm('确定删除此负债记录？')) return
      try {
        await axios.delete(`/api/liabilities/${id}`)
        fetchData()
      } catch (err) {
        console.error('删除失败:', err)
      }
    }
    
    // 分类 CRUD
    const openCategoryModal = (type = 'asset') => {
      categoryModalType.value = type
      editingCategory.value = null
      categoryForm.value = { name: '', type, icon: '📦', color: '#3b82f6' }
      showCategoryModal.value = true
    }
    
    const openCategoryModalFromForm = () => {
      const type = activeTab.value === 'assets' ? 'asset' : 'liability'
      openCategoryModal(type)
    }
    
    const editCategory = (cat) => {
      editingCategory.value = cat
      categoryForm.value = {
        name: cat.name,
        type: cat.type,
        icon: cat.icon || '📦',
        color: cat.color || '#3b82f6'
      }
      showCategoryModal.value = true
    }
    
    const submitCategory = async () => {
      try {
        if (editingCategory.value) {
          await axios.put(`/api/categories/${editingCategory.value.id}`, categoryForm.value)
        } else {
          await axios.post('/api/categories', categoryForm.value)
        }
        showCategoryModal.value = false
        fetchData()
      } catch (err) {
        console.error('保存分类失败:', err)
        alert('保存失败: ' + (err.response?.data?.error || '未知错误'))
      }
    }
    
    const deleteCategory = async (id) => {
      if (!confirm('确定删除此分类？')) return
      try {
        await axios.delete(`/api/categories/${id}`)
        fetchData()
      } catch (err) {
        console.error('删除分类失败:', err)
        alert('删除失败: ' + (err.response?.data?.error || '分类正在使用中'))
      }
    }
    
    // 标签 CRUD
    const openTagModal = () => {
      editingTag.value = null
      tagForm.value = { name: '', color: '#3b82f6' }
      showTagModal.value = true
    }

    const editTag = (tag) => {
      editingTag.value = tag
      tagForm.value = { name: tag.name, color: tag.color }
      showTagModal.value = true
    }

    const submitTag = async () => {
      try {
        if (editingTag.value) {
          await axios.put(`/api/tags/${editingTag.value.id}`, tagForm.value)
        } else {
          await axios.post('/api/tags', tagForm.value)
        }
        showTagModal.value = false
        fetchData()
      } catch (err) {
        console.error('保存标签失败:', err)
        alert('保存失败: ' + (err.response?.data?.error || '未知错误'))
      }
    }

    const deleteTag = async (id) => {
      if (!confirm('确定删除此标签？关联的资产/负债将移除该标签。')) return
      try {
        await axios.delete(`/api/tags/${id}`)
        fetchData()
      } catch (err) {
        console.error('删除标签失败:', err)
        alert('删除失败: ' + (err.response?.data?.error || '未知错误'))
      }
    }

    // 备份/恢复
    const exportBackup = async () => {
      backupLoading.value = true
      backupMessage.value = ''
      try {
        const res = await axios.get('/api/backup', { responseType: 'blob' })
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        const date = new Date().toISOString().slice(0, 10)
        link.setAttribute('download', `family-assets-backup-${date}.json`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        backupMessage.value = '✅ 导出成功！'
        backupMessageType.value = 'success'
      } catch (err) {
        console.error('导出失败:', err)
        backupMessage.value = '❌ 导出失败: ' + (err.response?.data?.error || '未知错误')
        backupMessageType.value = 'error'
      } finally {
        backupLoading.value = false
      }
    }

    const importBackup = async (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      
      if (!confirm('导入将覆盖当前所有数据，确定继续？')) {
        event.target.value = ''
        return
      }

      backupLoading.value = true
      backupMessage.value = ''
      try {
        const formData = new FormData()
        formData.append('file', file)
        await axios.post('/api/backup/restore', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        backupMessage.value = '✅ 导入成功！页面将刷新...'
        backupMessageType.value = 'success'
        setTimeout(() => fetchData(), 500)
      } catch (err) {
        console.error('导入失败:', err)
        backupMessage.value = '❌ 导入失败: ' + (err.response?.data?.error || '未知错误')
        backupMessageType.value = 'error'
      } finally {
        backupLoading.value = false
        event.target.value = ''
      }
    }
    
    // 修改密码
    const changePassword = async () => {
      passwordMessage.value = ''
      
      if (newPassword.value.length < 6) {
        passwordMessage.value = '❌ 新密码至少需要6位'
        passwordMessageType.value = 'error'
        return
      }
      
      if (newPassword.value !== confirmPassword.value) {
        passwordMessage.value = '❌ 两次输入的新密码不一致'
        passwordMessageType.value = 'error'
        return
      }
      
      passwordLoading.value = true
      try {
        await axios.post('/api/auth/change-password', {
          currentPassword: currentPassword.value,
          newPassword: newPassword.value
        })
        passwordMessage.value = '✅ 密码修改成功！'
        passwordMessageType.value = 'success'
        currentPassword.value = ''
        newPassword.value = ''
        confirmPassword.value = ''
      } catch (err) {
        console.error('修改密码失败:', err)
        passwordMessage.value = '❌ ' + (err.response?.data?.error || '修改失败，请重试')
        passwordMessageType.value = 'error'
      } finally {
        passwordLoading.value = false
      }
    }
    
    // 添加新账户
    const addNewAccount = async () => {
      accountMessage.value = ''
      
      if (newAccountPassword.value.length < 6) {
        accountMessage.value = '❌ 密码至少需要6位'
        accountMessageType.value = 'error'
        return
      }
      
      if (newAccountPassword.value !== newAccountConfirmPassword.value) {
        accountMessage.value = '❌ 两次输入的密码不一致'
        accountMessageType.value = 'error'
        return
      }
      
      accountLoading.value = true
      try {
        await axios.post('/api/auth/register', {
          username: newAccountUsername.value,
          password: newAccountPassword.value
        })
        accountMessage.value = '✅ 账户创建成功！'
        accountMessageType.value = 'success'
        newAccountUsername.value = ''
        newAccountPassword.value = ''
        newAccountConfirmPassword.value = ''
      } catch (err) {
        console.error('创建账户失败:', err)
        accountMessage.value = '❌ ' + (err.response?.data?.error || '创建失败，请重试')
        accountMessageType.value = 'error'
      } finally {
        accountLoading.value = false
      }
    }
    
    onMounted(() => {
      setupAxiosInterceptors()
      
      checkAuth().then(() => {
        if (isLoggedIn.value) {
          fetchData()
        }
      })
      
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
          theme.value = e.matches ? 'dark' : 'light'
        }
      })
    })
    
    return {
      theme,
      toggleTheme,
      // 认证相关
      isLoggedIn,
      currentUser,
      token,
      loginMode,
      authLoading,
      authError,
      isFirstUser,
      authForm,
      handleAuth,
      handleLogout,
      // 导航
      activeTab,
      navItems,
      // 数据
      stats,
      assets,
      liabilities,
      liabilitiesWithPayment,
      filteredAssets,
      filteredLiabilities,
      categories,
      tags,
      assetCategories,
      liabilityCategories,
      filterCategory,
      filterTag,
      filterLiabCategory,
      filterLiabTag,
      // 弹窗
      showAddModal,
      showCategoryModal,
      showTagModal,
      editingItem,
      editingCategory,
      editingTag,
      form,
      categoryForm,
      tagForm,
      calculatedPayment,
      // 备份
      backupLoading,
      backupMessage,
      backupMessageType,
      exportBackup,
      importBackup,
      // 密码修改
      currentPassword,
      newPassword,
      confirmPassword,
      passwordLoading,
      passwordMessage,
      passwordMessageType,
      changePassword,
      // 添加账户
      newAccountUsername,
      newAccountPassword,
      newAccountConfirmPassword,
      accountLoading,
      accountMessage,
      accountMessageType,
      addNewAccount,
      // 计算属性
      currentTitle,
      relevantCategories,
      // 工具方法
      formatMoney,
      getPercent,
      getLiabilityRate,
      getQualityHint,
      getBarWidth,
      getItemTags,
      getTagAssetCount,
      toggleFormTag,
      presetColors,
      // 数据操作
      fetchData,
      openAddModal,
      closeModal,
      editAsset,
      editLiability,
      submitForm,
      deleteAsset,
      deleteLiability,
      openCategoryModal,
      openCategoryModalFromForm,
      editCategory,
      submitCategory,
      deleteCategory,
      openTagModal,
      editTag,
      submitTag,
      deleteTag
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app.light {
  --bg-primary: #f8fafc;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f1f5f9;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --border-color: #e2e8f0;
  --border-color-light: #f1f5f9;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.1);
  --hover-bg: #f1f5f9;
  --input-bg: #ffffff;
  --input-border: #e2e8f0;
  --card-bg: #ffffff;
  --sidebar-bg: #ffffff;
  --gradient-start: #3b82f6;
  --gradient-end: #8b5cf6;
}

.app.dark {
  --bg-primary: #0a0a0b;
  --bg-secondary: #111113;
  --bg-tertiary: #18181b;
  --text-primary: #e5e5e5;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --border-color: #27272a;
  --border-color-light: #222;
  --shadow: none;
  --shadow-lg: 0 4px 20px rgba(0, 0, 0, 0.4);
  --hover-bg: #27272a;
  --input-bg: #18181b;
  --input-border: #27272a;
  --card-bg: #111113;
  --sidebar-bg: #111113;
  --gradient-start: #3b82f6;
  --gradient-end: #8b5cf6;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  min-height: 100vh;
}

.app {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* 登录页面样式 */
.login-page {
  position: fixed;
  inset: 0;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.login-container {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-lg);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.login-header h1 {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.tab {
  flex: 1;
  padding: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.tab:hover {
  background: var(--hover-bg);
}

.tab.active {
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  color: white;
  border-color: transparent;
}

.login-form .form-group {
  margin-bottom: 20px;
}

.login-form .form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.login-form .form-group input {
  width: 100%;
  padding: 12px 16px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 15px;
}

.login-form .form-group input:focus {
  outline: none;
  border-color: var(--gradient-start);
}

.login-form .form-group input::placeholder {
  color: var(--text-muted);
}

.first-user-hint {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
  border: 1px solid var(--gradient-start);
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: var(--gradient-start);
  margin-bottom: 20px;
}

.auth-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 12px;
  border-radius: 10px;
  font-size: 14px;
  margin-bottom: 20px;
}

.app.dark .auth-error {
  background: #7f1d1d;
  border-color: #991b1b;
  color: #fca5a5;
}

.btn-login {
  width: 100%;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  color: white;
  border: none;
  padding: 14px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-login:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.login-footer {
  margin-top: 24px;
  text-align: center;
}

/* 用户信息样式 */
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 16px;
  padding-right: 16px;
  border-right: 1px solid var(--border-color);
}

.username {
  font-weight: 500;
  color: var(--text-primary);
}

.role-tag {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.role-tag.admin {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
}

.role-tag.member {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.btn-logout {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-logout:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.sidebar {
  width: 240px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  margin-bottom: 32px;
}

.logo-icon { font-size: 28px; }

.logo-text {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 15px;
}

.nav-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.nav-item.active {
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  color: white;
}

.nav-icon { font-size: 18px; }



.theme-btn:hover {
  background: var(--hover-bg);
  transform: scale(1.05);
}

.main {
  flex: 1;
  padding: 32px 40px;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.header h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
}

.btn-primary {
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 15px;
  cursor: pointer;
}

.btn-secondary:hover { background: var(--hover-bg); }

.btn-icon {
  background: transparent;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.btn-icon:hover { background: var(--hover-bg); }
.btn-icon.danger:hover { background: #fef2f2; }
.app.dark .btn-icon.danger:hover { background: #7f1d1d; }

/* 欢迎栏 */
.welcome-bar {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px 24px;
  margin-bottom: 24px;
  font-size: 16px;
  color: var(--text-secondary);
  box-shadow: var(--shadow);
}

.welcome-bar strong {
  color: var(--text-primary);
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow);
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.stat-icon { font-size: 40px; }

.stat-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.stat-value.negative { color: #ef4444; }
.cash-assets .stat-value { color: #22c55e; }
.other-assets .stat-value { color: #8b5cf6; }
.total-liabilities .stat-value { color: #ef4444; }
.net-worth .stat-value { color: #3b82f6; }

/* 还款概览 */
.repayment-section {
  margin-bottom: 32px;
}

.section-header h3 {
  font-size: 18px;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.repayment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.repayment-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  box-shadow: var(--shadow);
}

.repayment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color-light);
}

.repayment-name {
  font-weight: 600;
  color: var(--text-primary);
}

.repayment-category {
  font-size: 13px;
  color: var(--text-muted);
}

.repayment-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.repayment-row .label { color: var(--text-secondary); }
.repayment-row .value { font-weight: 500; color: var(--text-primary); }
.repayment-row.highlight .value { color: #ef4444; font-weight: 600; }

/* 汇总 */
.summary-section {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-bottom: 32px;
}

.summary-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow);
}

.summary-card h3 {
  font-size: 16px;
  margin-bottom: 20px;
  color: var(--text-secondary);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color-light);
}

.summary-row.total {
  border-bottom: none;
  padding-top: 16px;
  font-weight: 600;
}

.summary-label { color: var(--text-primary); }
.summary-value { font-weight: 600; color: var(--text-primary); }
.summary-percent { font-size: 13px; color: var(--text-muted); width: 50px; text-align: right; }

.quality-item { margin-bottom: 16px; }

.quality-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-primary);
}

.quality-value { font-weight: 600; }
.quality-value.warning { color: #f59e0b; }
.quality-value.danger { color: #ef4444; }

.quality-bar {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.quality-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.quality-fill.cash { background: linear-gradient(90deg, #22c55e, #4ade80); }
.quality-fill.liability { background: linear-gradient(90deg, #ef4444, #f87171); }

.quality-hint {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

/* 图表 */
.charts-section {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.chart-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow);
}

.chart-card h3 {
  font-size: 16px;
  margin-bottom: 20px;
  color: var(--text-secondary);
}

.chart-bars {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chart-bar-item {
  display: grid;
  grid-template-columns: 100px 1fr 90px;
  align-items: center;
  gap: 12px;
}

.bar-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
}

.bar-icon { font-size: 14px; }

.bar-container {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.bar-fill.cash { background: linear-gradient(90deg, #22c55e, #4ade80); }
.bar-fill.other { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
.bar-fill.liability { background: linear-gradient(90deg, #ef4444, #f87171); }

.bar-value {
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-chart {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
}

/* 列表 */
.list-view {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow);
}

.list-header {
  display: grid;
  grid-template-columns: 1fr 80px 120px 120px 130px 110px 80px;
  padding: 16px 24px;
  background: var(--bg-tertiary);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.list-body {
  max-height: 500px;
  overflow-y: auto;
}

.list-row {
  display: grid;
  grid-template-columns: 1fr 80px 120px 120px 130px 110px 80px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color-light);
  align-items: center;
}

.list-row:hover { background: var(--hover-bg); }

.col-name { font-weight: 500; color: var(--text-primary); }
.col-tags { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }

.type-tag {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.type-tag.cash { background: #dcfce7; color: #16a34a; }
.type-tag.other { background: #ede9fe; color: #7c3aed; }
.app.dark .type-tag.cash { background: #14532d; color: #86efac; }
.app.dark .type-tag.other { background: #3b0764; color: #c4b5fd; }

.category-tag {
  background: var(--bg-tertiary);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  color: var(--text-primary);
}

.category-tag.liability { background: #fef2f2; color: #dc2626; }
.app.dark .category-tag.liability { background: #7f1d1d; color: #fca5a5; }

/* 标签药丸样式 */
.tag-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
  white-space: nowrap;
}

.text-muted {
  color: var(--text-muted);
  font-size: 13px;
}

.col-value.highlight { color: #22c55e; font-weight: 600; }
.col-value.liability { color: #ef4444; }
.col-actions { display: flex; gap: 4px; }

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
}

.empty-state.wide { grid-column: 1 / -1; }

/* 负债列表特殊样式 */
.liability-list .list-header,
.liability-list .list-row {
  grid-template-columns: 1fr 100px 120px 120px 70px 100px 80px;
}

/* 分类管理 */
.categories-view {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.category-section h3 {
  font-size: 18px;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.category-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-icon { font-size: 24px; }
.category-name { flex: 1; font-weight: 500; color: var(--text-primary); }
.category-actions { display: flex; gap: 4px; }

/* 标签管理页 */
.tags-view {
  min-height: 200px;
}

.tags-section {
  margin-top: 32px;
}

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.tag-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  box-shadow: var(--shadow);
  transition: all 0.2s;
}

.tag-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.tag-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.tag-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-card-name {
  flex: 1;
  font-weight: 600;
  font-size: 16px;
  color: var(--text-primary);
}

.tag-card-actions {
  display: flex;
  gap: 2px;
}

.tag-card-footer {
  font-size: 13px;
  color: var(--text-muted);
  padding-top: 12px;
  border-top: 1px solid var(--border-color-light);
}

.tag-card-footer strong {
  color: var(--text-primary);
}

/* 标签选择器（表单内） */
.tag-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--input-border);
  border-radius: 10px;
  min-height: 44px;
}

.tag-check-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  user-select: none;
}

.tag-check-item:hover {
  border-color: var(--text-muted);
}

.tag-check-item.checked {
  background: var(--bg-tertiary);
  border-color: var(--gradient-start);
  color: var(--text-primary);
}

.tag-check-mark {
  font-size: 12px;
  font-weight: 600;
  color: var(--gradient-start);
}

/* 颜色选择器 */
.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color-option {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--text-muted);
}

/* 设置页 */
.settings-view {
  max-width: 600px;
}

.settings-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow);
}

.settings-card h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.settings-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.settings-actions {
  display: flex;
  gap: 12px;
}

.btn-upload {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.btn-upload.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.backup-message {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
}

.backup-message.success {
  background: #dcfce7;
  color: #16a34a;
}

.app.dark .backup-message.success {
  background: #14532d;
  color: #86efac;
}

.backup-message.error {
  background: #fef2f2;
  color: #dc2626;
}

.app.dark .backup-message.error {
  background: #7f1d1d;
  color: #fca5a5;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal.large { max-width: 560px; }

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 { font-size: 18px; font-weight: 600; color: var(--text-primary); }

.btn-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 28px;
  cursor: pointer;
  line-height: 1;
}

.btn-close:hover { color: var(--text-primary); }

.modal-body { padding: 24px; }

.form-group { margin-bottom: 20px; }

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 15px;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--gradient-start);
}

.form-group input::placeholder,
.form-group textarea::placeholder { color: var(--text-muted); }

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.category-select {
  display: flex;
  gap: 8px;
}

.category-select select { flex: 1; }

.btn-add-category {
  padding: 0 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-primary);
}

.type-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.type-option {
  padding: 16px;
  background: var(--bg-tertiary);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  font-size: 15px;
  cursor: pointer;
  color: var(--text-primary);
}

.type-option:hover { border-color: var(--text-muted); }
.type-option.active {
  border-color: var(--gradient-start);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
}

.type-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

/* 还款表单 */
.repayment-form {
  margin: 20px 0;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 12px;
}

.repayment-form h4 {
  font-size: 14px;
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.payment-preview {
  margin-top: 16px;
  padding: 12px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.preview-row span:first-child { color: var(--text-secondary); }
.preview-value { font-weight: 600; color: var(--text-primary); }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

/* 响应式 */
@media (max-width: 1400px) {
  .charts-section { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 1200px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .summary-section { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .sidebar { width: 70px; padding: 16px 8px; }
  .logo-text, .nav-text { display: none; }
  .theme-btn { padding: 8px; font-size: 18px; }
  .main { padding: 20px; }
  .stats-grid { grid-template-columns: 1fr; }
  .charts-section { grid-template-columns: 1fr; }
  .list-header, .list-row { grid-template-columns: 1fr 1fr; }
  .col-type, .col-date, .col-actions, .col-tags { display: none; }
  .form-row { grid-template-columns: 1fr; }
  .user-info { flex-wrap: wrap; border-right: none; padding-right: 0; margin-right: 0; }
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  margin-bottom: 8px;
}
.filter-select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}
.filter-select:focus {
  outline: none;
  border-color: var(--primary);
}

/* 标签网格 */
.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.tag-card {
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 12px;
  border: 1px solid var(--border-color);
}
.tag-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tag-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tag-card-name {
  flex: 1;
  font-weight: 500;
  font-size: 14px;
}
.tag-card-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.tag-card:hover .tag-card-actions {
  opacity: 1;
}
.section-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-header-row h3 {
  margin: 0;
}
.btn-sm {
  padding: 4px 12px;
  font-size: 13px;
  border-radius: 6px;
}

/* 全局主题切换浮动按钮 */
.theme-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  font-size: 24px;
  cursor: pointer;
  z-index: 1000;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.theme-fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0,0,0,0.2);
}
</style>
