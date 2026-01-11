<template>
    <header class="app-header">
        <div class="header-content">
            <NuxtLink to="/" class="brand">Greg Miller Online</NuxtLink>
            <nav>
                <NuxtLink to="/">Home</NuxtLink>
                <NuxtLink to="/resume">Resume</NuxtLink>
                <NuxtLink to="/contact">Contact</NuxtLink>
                <div class="categories" v-if="categories && categories.length">
                    <span>Categories:</span>
                    <NuxtLink 
                        v-for="cat in categories" 
                        :key="cat" 
                        :to="`/category/${encodeURIComponent(cat)}`"
                        class="category-link"
                    >
                        {{ cat }}
                    </NuxtLink>
                </div>
            </nav>
        </div>
    </header>
</template>

<script setup>
const { data: categories } = await useFetch('/api/categories');
</script>

<style scoped>
.app-header {
    background: #fff;
    border-bottom: 1px solid #eee;
    padding: 1rem 0;
    margin-bottom: 2rem;
}

.header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
}

@media (min-width: 768px) {
    .header-content {
        flex-direction: row;
        justify-content: space-between;
    }
}

.brand {
    font-size: 1.5rem;
    font-weight: bold;
    text-decoration: none;
    color: #333;
    margin-bottom: 1rem;
}

@media (min-width: 768px) {
    .brand {
        margin-bottom: 0;
    }
}

nav {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
}

nav a {
    text-decoration: none;
    color: #666;
    font-weight: 500;
}

nav a.router-link-active {
    color: #0063dc;
}

.categories {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    border-left: 1px solid #ddd;
    padding-left: 1rem;
    margin-left: 1rem;
}

.category-link {
    font-size: 0.9rem;
}
</style>
