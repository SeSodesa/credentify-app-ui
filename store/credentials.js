/* Stores the credentials of an individual */
export const state = () => ({
  credentials: []
})

export const mutations = {
  setCredentials(state, credentials) {
    state.credentials = credentials
  },
  forgetCredentials(state) {
    state.credentials = []
  }
}

export const actions = {
  async getCredentials({ commit }, data) {
    if (data) {
      commit('setCredentials', data)
    } else {
      const credentials = await this.$axios
        .get('/profile/credentials')
        .then((response) => response.data.data)
      commit('setCredentials', credentials)
    }
  },
  credentialsExist(state) {
    return state.credentials.length > 0
  }
}
