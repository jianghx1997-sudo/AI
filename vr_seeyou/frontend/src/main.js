import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Vant 样式
import 'vant/lib/index.css'
import './styles/theme.css'

// Vant 组件 - 手动导入
import {
  NavBar,
  Tabbar,
  TabbarItem,
  Button,
  Tag,
  Icon,
  Loading,
  Dialog,
  Toast,
  Search,
  Empty,
  Cell,
  CellGroup,
  Image as VanImage,
  Uploader,
  Grid,
  GridItem,
  Col,
  Row,
  Popup,
  ActionSheet,
  DropdownMenu,
  DropdownItem,
  PullRefresh,
  List,
  Swipe,
  SwipeItem,
  NoticeBar,
  Divider,
  Space,
  ConfigProvider,
  Field,
  Form,
  Switch,
  Picker,
  Stepper
} from 'vant'

const app = createApp(App)

// 注册 Vant 组件
app.use(NavBar)
app.use(Tabbar)
app.use(TabbarItem)
app.use(Button)
app.use(Tag)
app.use(Icon)
app.use(Loading)
app.use(Dialog)
app.use(Toast)
app.use(Search)
app.use(Empty)
app.use(Cell)
app.use(CellGroup)
app.use(VanImage)
app.use(Uploader)
app.use(Grid)
app.use(GridItem)
app.use(Col)
app.use(Row)
app.use(Popup)
app.use(ActionSheet)
app.use(DropdownMenu)
app.use(DropdownItem)
app.use(PullRefresh)
app.use(List)
app.use(Swipe)
app.use(SwipeItem)
app.use(NoticeBar)
app.use(Divider)
app.use(Space)
app.use(ConfigProvider)
app.use(Field)
app.use(Form)
app.use(Switch)
app.use(Picker)
app.use(Stepper)

app.use(createPinia())
app.use(router)

app.mount('#app')
