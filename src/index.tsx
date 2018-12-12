import * as ui from "hyperoop";
import { APIRefController } from "./controller/apiref";
import { MainController} from "./controller/main";
import { NavbarController } from "./controller/navbar";
import { HRoute } from "./utils/hroute";
import { APIRefContent, APIRefSidebar } from "./view/apiref";
import { NavbarMenuUl } from "./view/navbar";

async function main() {
    const mainController = new MainController();
    const apirefController = new APIRefController(mainController);
    const navbarController = new NavbarController(["HyperOOP", "Router"]);

    apirefController.Router.go("./#apiref-HyperOOP");
    if (apirefController.Fresh) { await apirefController.onLocationChange(null); }

    const navbarView = () => (
        <NavbarMenuUl
            hasTutorial={false}
            hasDonationsPage={false}
            examples={[]}
            reference={navbarController.State.apirefData}
            searchArgs = {null}
        />
    );

    const apiSidebarView = () => (
        <HRoute
            exact = {false}
            hash = "#apiref-:module-:identifier"
            component = {APIRefSidebar(apirefController.TOCCtrl.State.sections)}/>
    );

    const apiRefContentView = () => (
        <APIRefContent
            module = {apirefController.TreeCtrl.State.modName}
            sections = {apirefController.TreeCtrl.State.sections}
        />
    );

    ui.init(document.getElementById("navbarPlace"), navbarView, navbarController);
    ui.init(document.getElementById("sidebarPlace"), apiSidebarView, apirefController.TOCCtrl);
    ui.init(document.getElementById("contentPlace"), apiRefContentView, apirefController.TreeCtrl);
}

main();