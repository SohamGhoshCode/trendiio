import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import api from '../../api/axios.js'
import toast from 'react-hot-toast'

const initialState = {
    value: null,
    loading: false
}

// Fetch user data
export const fetchUser = createAsyncThunk(
    'user/fetchUser',
    async (token, { rejectWithValue }) => {
        try {
            const { data } = await api.get('/api/user/data', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
            return data.success ? data.user : null
        } catch (error) {
            return rejectWithValue(error.response?.data?.message)
        }
    }
)

// Update user data
export const updateUser = createAsyncThunk(
    'user/update',
    async ({ userData, token }, { rejectWithValue }) => {
        try {
            const { data } = await api.post(
                '/api/user/update',
                userData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )

            if (data.success) {
                toast.success(data.message)
                return data.user
            } else {
                toast.error(data.message)
                return null
            }
        } catch (error) {
            toast.error('Update failed')
            return rejectWithValue(error.response?.data?.message)
        }
    }
)

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        logout: (state) => {
            state.value = null
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUser.pending, (state) => {
                state.loading = true
            })
            .addCase(fetchUser.fulfilled, (state, action) => {
                state.loading = false
                state.value = action.payload
            })

            .addCase(updateUser.fulfilled, (state, action) => {
            if (action.payload) {
                state.value = action.payload
            }
            })
    }
})

export const { logout } = userSlice.actions
export default userSlice.reducer
