<template>
  <div class="sidebar">
    <div class="sidebartitle">
      <img src="~/assets/icons/credentify.svg" alt="Credentify logo" />
      <span>Credentify</span>
    </div>
    <div v-if="this.$auth.loggedIn" class="sidebaritems">
      <div
        v-for="menuitem in filteredMenuItems"
        :key="menuitem.label"
        class="sidebaritem"
      >
        <NuxtLink :to="menuitem.url">
          <svg
            v-if="menuitem.label.toLowerCase().startsWith('skill rose')"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            width="25"
            viewBox="0 0 618 600"
          >
            <title>Alternative version of Gorean dina symbol.</title>
            <defs>
              <path
                id="Petal"
                stroke-width="74.91"
                d="M382.9584352 525.560421 A390.1261514 390.1261514 0 1 1 -152.4344314 240.8869842"
              />
            </defs>
            <g
              transform="translate(309,317.1885) scale(0.3,-0.3)"
              fill="none"
              stroke="#ffffff"
            >
              <circle
                cx="0"
                cy="0"
                stroke-width="121.2069261"
                r="261.6353856"
              />
              <use xlink:href="#Petal" />
              <use transform="rotate(72)" xlink:href="#Petal" />
              <use transform="rotate(144)" xlink:href="#Petal" />
              <use transform="rotate(216)" xlink:href="#Petal" />
              <use transform="rotate(288)" xlink:href="#Petal" />
            </g>
          </svg>
          <img v-else :src="menuitem.icon" />
          <span>{{ menuitem.label }}</span>
        </NuxtLink>
      </div>
    </div>
    <div class="zeroxcert-advertisement">
      <a href="https://github.com/0xcert/framework">
        Powered by <br />0xcert framework
      </a>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  computed: {
    ...mapState({
      sidebarOpen: (state) => state.nav.sidebarOpen,
      menuItems: (state) => state.nav.menuItems,
      requiredUserViewRights: (state) =>
        state.nav.menuItems[2].requiredAbilities,
      profileAbilities: (state) => state.profile.profileAbilities
    }),
    filteredMenuItems() {
      const filteredItems = []
      for (const item of this.menuItems) {
        if (item.label === 'Users') {
          let allowedToViewUsers = false
          for (const ability of this.$auth.user.communityAbilities) {
            if (ability.kind === 2002) {
              allowedToViewUsers = true
              break
            }
          }
          if (allowedToViewUsers) {
            filteredItems.push(item)
          }
        } else {
          filteredItems.push(item)
        }
      }
      return filteredItems
    }
  }
}
</script>

<style lang="scss">
.sidebar {
  background-color: $gray-dark;
  flex-shrink: 0;
  width: var(--sidebar-width);

  .sidebartitle {
    align-items: center;
    border-bottom-style: solid;
    border-color: $gray;
    color: $white;
    display: flex;
    justify-content: flex-start;
    padding: 1rem;

    img {
      padding-right: 10px;
    }

    span {
      font-weight: bold;
    }
  }

  .sidebaritem {
    align-items: center;
    display: flex;
    width: 100%;

    /* For NuxtLinks inside sidebaritems */
    > a {
      align-items: center;
      border-bottom-style: solid;
      border-bottom-width: thin;
      border-color: $gray;
      color: $white;
      display: flex;
      height: 70px;
      padding: 1rem;
      width: 100%;

      img,
      svg {
        margin-right: 15px;
        width: 25px;
      }
    }
  }

  .sidebaritem:hover {
    border-left-color: $blue-light;
    border-left-style: solid;
  }

  .zeroxcert-advertisement {
    align-items: center;
    background-color: $gray-dark;
    bottom: 0;
    font-weight: bold;
    left: 0;
    opacity: 1;
    padding: 1rem;
    position: absolute;
    width: var(--sidebar-width);

    > a {
      color: $gray-light;
      width: 100%;
    }
  }
}
</style>
